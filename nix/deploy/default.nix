{inputs, ...}: {
  perSystem = {
    lib,
    pkgs,
    system,
    ...
  }: let
    deploy-rs = inputs.deploy-rs.packages.${system}.default;

    runMicrovm = pkgs.writeShellApplication {
      name = "eulesia-run-microvm";
      runtimeInputs = with pkgs; [
        coreutils
        curl
        gnugrep
        iproute2
        nix
        openssh
      ];
      text = ''
        set -euo pipefail

        REPO_ROOT=$(pwd -P)
        SSH_BIN=${pkgs.openssh}/bin/ssh
        QEMU_PID=""
        SSH_OPTS=(
          -p 2223
          -o BatchMode=yes
          -o ConnectTimeout=2
          -o StrictHostKeyChecking=no
          -o UserKnownHostsFile=/dev/null
        )
        NIX_COPY_SSHOPTS="-p 2223 -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
        VM_SOPS_AGE_KEY_FILE="''${EULESIA_VM_AGE_KEY_FILE:-$HOME/.local/share/eulesia/vm-sops-age.key}"
        BOOTSTRAP_PID=""

        ensure_clean_secret_surface() {
          for path in \
            "$REPO_ROOT/secrets.env" \
            "$REPO_ROOT/idura-oauth2-client-secret"
          do
            if [ -e "$path" ]; then
              echo "Unsafe plaintext secret artifact present: $path"
              echo "Move it out of the repo tree before running the VM."
              exit 1
            fi
          done
        }

        ensure_vm_age_key() {
          if [ ! -f "$VM_SOPS_AGE_KEY_FILE" ]; then
            echo "Missing local VM age key: $VM_SOPS_AGE_KEY_FILE"
            echo "Create or restore the dedicated VM sops key before running the VM."
            exit 1
          fi
        }

        wait_for_ssh() {
          echo "Waiting for SSH on localhost:2223..."
          ATTEMPT=0
          until "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost true >/dev/null 2>&1; do
            ATTEMPT=$((ATTEMPT + 1))
            if [ "$ATTEMPT" -ge 60 ]; then
              echo "SSH did not become ready in time; skipping automatic activation."
              return 1
            fi
            sleep 1
          done
        }

        wait_for_remote_service() {
          UNIT="$1"
          ATTEMPT=0
          until "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost "systemctl is-active --quiet '$UNIT'" >/dev/null 2>&1; do
            ATTEMPT=$((ATTEMPT + 1))
            if [ "$ATTEMPT" -ge 60 ]; then
              echo "Timed out waiting for $UNIT to become active."
              return 1
            fi
            sleep 1
          done
        }

        wait_for_local_http() {
          NAME="$1"
          URL="$2"
          ATTEMPT=0
          until curl --fail --silent --show-error "$URL" >/dev/null; do
            ATTEMPT=$((ATTEMPT + 1))
            if [ "$ATTEMPT" -ge 60 ]; then
              echo "Timed out waiting for $NAME health at $URL."
              return 1
            fi
            sleep 1
          done
        }

        wait_for_database() {
          ATTEMPT=0
          until "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost \
            "su -s /bin/sh eulesia -c 'psql -d eulesia -Atqc \"select 1\" >/dev/null'" >/dev/null 2>&1
          do
            ATTEMPT=$((ATTEMPT + 1))
            if [ "$ATTEMPT" -ge 60 ]; then
              echo "Timed out waiting for PostgreSQL socket access as the eulesia user."
              return 1
            fi
            sleep 1
          done
        }

        report_vm_status() {
          "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost \
            "systemctl --no-pager --full status postgresql.service nginx.service meilisearch.service eulesia-api.service || true"
          "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost \
            "journalctl -u meilisearch.service -u eulesia-api.service -n 80 --no-pager || true"
        }

        wait_for_vm_readiness() {
          wait_for_remote_service postgresql.service
          wait_for_remote_service nginx.service
          wait_for_remote_service meilisearch.service
          wait_for_remote_service eulesia-api.service
          wait_for_database
          wait_for_local_http "Meilisearch" "http://localhost:17701/health"
          wait_for_local_http "API" "http://localhost:18080/api/v1/health"
        }

        echo "Starting the Eulesia MicroVM..."
        echo ""
        echo "Access:"
        echo "  - App + API: http://localhost:18080"
        echo "  - Meilisearch: http://localhost:17701/health"
        echo "  - SSH: ssh root@localhost -p 2223"
        echo ""
        echo "The VM will try to bootstrap /var/lib/sops-nix/key.txt from:"
        echo "  $VM_SOPS_AGE_KEY_FILE"
        echo ""
        echo "Press Ctrl+A then X to exit QEMU, or Ctrl+C to stop."
        echo ""

        ensure_clean_secret_surface
        ensure_vm_age_key

        if ss -ltn "( sport = :18080 or sport = :2223 or sport = :17701 )" | tail -n +2 | grep -q .; then
          echo "One or more required localhost ports are already in use:"
          ss -ltnp "( sport = :18080 or sport = :2223 or sport = :17701 )" || true
          exit 1
        fi

        RUNNER=$(nix build .#nixosConfigurations.eulesia-vm.config.microvm.runner.qemu --print-out-paths --no-link)

        bootstrap_vm() {
          if ! wait_for_ssh; then
            return 0
          fi

          echo "Installing local sops age key into the VM..."
          "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost "install -d -m 700 /var/lib/sops-nix"
          cat "$VM_SOPS_AGE_KEY_FILE" \
            | "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost \
                "cat > /var/lib/sops-nix/key.txt && chmod 600 /var/lib/sops-nix/key.txt && chown root:root /var/lib/sops-nix/key.txt"

          echo "Activating the current Eulesia VM configuration..."
          SYSTEM_PATH=$(nix build .#nixosConfigurations.eulesia-vm.config.system.build.toplevel --print-out-paths --no-link)
          NIX_SSHOPTS="$NIX_COPY_SSHOPTS" nix copy --no-check-sigs --to ssh-ng://root@localhost "$SYSTEM_PATH"
          "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost \
            "nix-env -p /nix/var/nix/profiles/system --set '$SYSTEM_PATH' && /nix/var/nix/profiles/system/bin/switch-to-configuration switch"

          echo "Waiting for VM services to become healthy..."
          if wait_for_vm_readiness; then
            echo "VM services activated."
            echo "Ready:"
            echo "  - App + API: http://localhost:18080"
            echo "  - API health: http://localhost:18080/api/v1/health"
            echo "  - Meilisearch: http://localhost:17701/health"
            return 0
          fi

          echo "VM activation finished, but readiness checks failed."
          report_vm_status
          return 1
        }

        cleanup() {
          echo ""
          echo "Shutting down the Eulesia MicroVM..."

          if [ -n "$BOOTSTRAP_PID" ]; then
            kill "$BOOTSTRAP_PID" 2>/dev/null || true
          fi

          if [ -n "$QEMU_PID" ]; then
            kill "$QEMU_PID" 2>/dev/null || true
          fi

          "$RUNNER/bin/microvm-shutdown" 2>/dev/null || true
          "$RUNNER/bin/virtiofsd-shutdown" 2>/dev/null || true
        }

        trap cleanup EXIT
        trap 'true' INT TERM

        "$RUNNER/bin/virtiofsd-run" &
        VIRTIOFSD_PID=$!
        sleep 3

        "$RUNNER/bin/microvm-run" &
        QEMU_PID=$!

        bootstrap_vm &
        BOOTSTRAP_PID=$!

        wait $QEMU_PID || wait $QEMU_PID
        kill "$VIRTIOFSD_PID" 2>/dev/null || true
      '';
    };

    deployVm = pkgs.writeShellApplication {
      name = "eulesia-deploy-vm";
      runtimeInputs = with pkgs; [
        coreutils
        curl
        nix
        openssh
      ];
      text = ''
        set -euo pipefail

        REPO_ROOT=$(pwd -P)
        SSH_BIN=${pkgs.openssh}/bin/ssh
        SSH_OPTS=(
          -p 2223
          -o BatchMode=yes
          -o ConnectTimeout=2
          -o StrictHostKeyChecking=no
          -o UserKnownHostsFile=/dev/null
        )
        NIX_COPY_SSHOPTS="-p 2223 -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
        VM_SOPS_AGE_KEY_FILE="''${EULESIA_VM_AGE_KEY_FILE:-$HOME/.local/share/eulesia/vm-sops-age.key}"

        ensure_clean_secret_surface() {
          for path in \
            "$REPO_ROOT/secrets.env" \
            "$REPO_ROOT/idura-oauth2-client-secret"
          do
            if [ -e "$path" ]; then
              echo "Unsafe plaintext secret artifact present: $path"
              echo "Move it out of the repo tree before deploying the VM."
              exit 1
            fi
          done
        }

        ensure_vm_age_key() {
          if [ ! -f "$VM_SOPS_AGE_KEY_FILE" ]; then
            echo "Missing local VM age key: $VM_SOPS_AGE_KEY_FILE"
            echo "Create or restore the dedicated VM sops key before deploying."
            exit 1
          fi
        }

        wait_for_ssh() {
          ATTEMPT=0
          until "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost true >/dev/null 2>&1; do
            ATTEMPT=$((ATTEMPT + 1))
            if [ "$ATTEMPT" -ge 60 ]; then
              echo "Unable to reach root@localhost:2223."
              echo "Start the VM first with just vm-run."
              exit 1
            fi
            sleep 1
          done
        }

        wait_for_remote_service() {
          UNIT="$1"
          ATTEMPT=0
          until "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost "systemctl is-active --quiet '$UNIT'" >/dev/null 2>&1; do
            ATTEMPT=$((ATTEMPT + 1))
            if [ "$ATTEMPT" -ge 60 ]; then
              echo "Timed out waiting for $UNIT to become active."
              return 1
            fi
            sleep 1
          done
        }

        wait_for_local_http() {
          NAME="$1"
          URL="$2"
          ATTEMPT=0
          until curl --fail --silent --show-error "$URL" >/dev/null; do
            ATTEMPT=$((ATTEMPT + 1))
            if [ "$ATTEMPT" -ge 60 ]; then
              echo "Timed out waiting for $NAME health at $URL."
              return 1
            fi
            sleep 1
          done
        }

        wait_for_database() {
          ATTEMPT=0
          until "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost \
            "su -s /bin/sh eulesia -c 'psql -d eulesia -Atqc \"select 1\" >/dev/null'" >/dev/null 2>&1
          do
            ATTEMPT=$((ATTEMPT + 1))
            if [ "$ATTEMPT" -ge 60 ]; then
              echo "Timed out waiting for PostgreSQL socket access as the eulesia user."
              return 1
            fi
            sleep 1
          done
        }

        report_vm_status() {
          "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost \
            "systemctl --no-pager --full status postgresql.service nginx.service meilisearch.service eulesia-api.service || true"
          "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost \
            "journalctl -u meilisearch.service -u eulesia-api.service -n 80 --no-pager || true"
        }

        wait_for_vm_readiness() {
          wait_for_remote_service postgresql.service
          wait_for_remote_service nginx.service
          wait_for_remote_service meilisearch.service
          wait_for_remote_service eulesia-api.service
          wait_for_database
          wait_for_local_http "Meilisearch" "http://localhost:17701/health"
          wait_for_local_http "API" "http://localhost:18080/api/v1/health"
        }

        echo "Building the Eulesia VM system..."
        SYSTEM_PATH=$(nix build .#nixosConfigurations.eulesia-vm.config.system.build.toplevel --print-out-paths --no-link)
        echo "System path: $SYSTEM_PATH"

        ensure_clean_secret_surface
        ensure_vm_age_key
        wait_for_ssh

        if [ -f "$VM_SOPS_AGE_KEY_FILE" ]; then
          echo "Installing local sops age key into the VM..."
          "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost "install -d -m 700 /var/lib/sops-nix"
          cat "$VM_SOPS_AGE_KEY_FILE" \
            | "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost \
                "cat > /var/lib/sops-nix/key.txt && chmod 600 /var/lib/sops-nix/key.txt && chown root:root /var/lib/sops-nix/key.txt"
        else
          echo "No local VM sops age key found at $VM_SOPS_AGE_KEY_FILE."
          echo "Assuming the VM already has a matching /var/lib/sops-nix/key.txt."
        fi

        echo "Switching the running VM configuration..."
        NIX_SSHOPTS="$NIX_COPY_SSHOPTS" nix copy --no-check-sigs --to ssh-ng://root@localhost "$SYSTEM_PATH"
        "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost \
          "nix-env -p /nix/var/nix/profiles/system --set '$SYSTEM_PATH' && /nix/var/nix/profiles/system/bin/switch-to-configuration switch"

        echo "Waiting for VM services to become healthy..."
        if wait_for_vm_readiness; then
          echo "Deployment complete."
          exit 0
        fi

        echo "Configuration switched, but readiness checks failed."
        report_vm_status
        exit 1
      '';
    };
  in {
    apps = lib.optionalAttrs (system == "x86_64-linux") {
      deploy = {
        type = "app";
        program = "${pkgs.writeShellScript "eulesia-deploy" ''
          set -euo pipefail
          exec ${deploy-rs}/bin/deploy .#eulesia-prod "$@"
        ''}";
        meta.description = "Deploy the Eulesia production NixOS configuration with deploy-rs";
      };

      deploy-test = {
        type = "app";
        program = "${pkgs.writeShellScript "eulesia-deploy-test" ''
          set -euo pipefail
          exec ${deploy-rs}/bin/deploy .#eulesia-test "$@"
        ''}";
        meta.description = "Deploy the Eulesia test NixOS configuration with deploy-rs";
      };

      microvm = {
        type = "app";
        program = "${runMicrovm}/bin/eulesia-run-microvm";
        meta.description = "Run the local Eulesia MicroVM and expose app, SSH, and Meilisearch on localhost";
      };

      deploy-vm = {
        type = "app";
        program = "${deployVm}/bin/eulesia-deploy-vm";
        meta.description = "Hot-deploy the current Eulesia NixOS configuration into the running local MicroVM";
      };
    };

    checks = lib.optionalAttrs (system == "x86_64-linux") (
      inputs.deploy-rs.lib.${system}.deployChecks inputs.self.deploy
    );
  };

  flake = {
    nixosModules.default = import ../modules/eulesia.nix;
    nixosModules.eulesia = import ../modules/eulesia.nix;

    nixosConfigurations = {
      eulesia-prod = inputs.nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        specialArgs = {
          inherit inputs;
          eulesiaPackages = inputs.self.packages.x86_64-linux;
        };
        modules = [
          inputs.sops-nix.nixosModules.sops
          ../hosts/eulesia-prod.nix
        ];
      };

      eulesia-vm = inputs.nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        specialArgs = {
          inherit inputs;
          eulesiaPackages = inputs.self.packages.x86_64-linux;
        };
        modules = [
          inputs.microvm.nixosModules.microvm
          inputs.sops-nix.nixosModules.sops
          ../hosts/eulesia-vm.nix
        ];
      };

      eulesia-test = inputs.nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        specialArgs = {
          inherit inputs;
          eulesiaPackages = inputs.self.packages.x86_64-linux;
        };
        modules = [
          inputs.sops-nix.nixosModules.sops
          ../hosts/eulesia-test.nix
        ];
      };
    };

    deploy.nodes.eulesia-prod = {
      hostname = "95.216.206.136";
      sshUser = "root";
      fastConnection = true;
      profiles.system = {
        user = "root";
        path = inputs.deploy-rs.lib.x86_64-linux.activate.nixos inputs.self.nixosConfigurations.eulesia-prod;
      };
    };

    deploy.nodes.eulesia-test = {
      hostname = "test.eulesia.eu";
      sshUser = "root";
      fastConnection = true;
      profiles.system = {
        user = "root";
        path = inputs.deploy-rs.lib.x86_64-linux.activate.nixos inputs.self.nixosConfigurations.eulesia-test;
      };
    };
  };
}
