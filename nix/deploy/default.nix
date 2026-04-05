{inputs, ...}: {
  perSystem = {
    lib,
    pkgs,
    system,
    ...
  }: let
    deploy-rs = inputs.deploy-rs.packages.${system}.default;
    inherit (inputs.nixos-anywhere.packages.${system}) nixos-anywhere;

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
            "$REPO_ROOT/idura-oauth2-client-secret" \
            "$REPO_ROOT/idura-signing-key.jwk.json" \
            "$REPO_ROOT/idura-encryption-key.jwk.json" \
            "$REPO_ROOT/sig.jwk.json" \
            "$REPO_ROOT/enc.jwk.json" \
            "$REPO_ROOT/jwks.private.json"
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
            "systemctl --no-pager --full status postgresql.service nginx.service meilisearch.service eulesia-server.service || true"
          "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost \
            "journalctl -u meilisearch.service -u eulesia-server.service -n 80 --no-pager || true"
        }

        wait_for_vm_readiness() {
          wait_for_remote_service postgresql.service
          wait_for_remote_service nginx.service
          wait_for_remote_service meilisearch.service
          wait_for_remote_service eulesia-server.service
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
            "$REPO_ROOT/idura-oauth2-client-secret" \
            "$REPO_ROOT/idura-signing-key.jwk.json" \
            "$REPO_ROOT/idura-encryption-key.jwk.json" \
            "$REPO_ROOT/sig.jwk.json" \
            "$REPO_ROOT/enc.jwk.json" \
            "$REPO_ROOT/jwks.private.json"
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

        ensure_remote_store_space() {
          FREE_KB=$(
            "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost \
              "df -Pk /nix/.rw-store 2>/dev/null | awk 'NR==2 { print \$4 }'"
          )

          if [ -z "$FREE_KB" ] || [ "$FREE_KB" -lt 1048576 ]; then
            echo "The VM writable Nix store overlay is too full for deployment."
            "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost \
              "df -h / /nix/.rw-store /var || true"
            echo "Restart the VM with just vm-run so it picks up the current disk layout."
            exit 1
          fi
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
            "systemctl --no-pager --full status postgresql.service nginx.service meilisearch.service eulesia-server.service || true"
          "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost \
            "journalctl -u meilisearch.service -u eulesia-server.service -n 80 --no-pager || true"
        }

        wait_for_vm_readiness() {
          wait_for_remote_service postgresql.service
          wait_for_remote_service nginx.service
          wait_for_remote_service meilisearch.service
          wait_for_remote_service eulesia-server.service
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
        ensure_remote_store_space

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

    rebuildTest = pkgs.writeShellApplication {
      name = "eulesia-rebuild-test";
      runtimeInputs = with pkgs; [
        coreutils
        nix
        nixos-rebuild
        openssh
      ];
      text = ''
        set -euo pipefail

        TARGET_HOST="''${EULESIA_TEST_TARGET_HOST:-eulesia-server-test}"
        TARGET_USER="''${EULESIA_TEST_SSH_USER:-root}"
        BUILD_HOST="''${EULESIA_TEST_BUILD_HOST:-localhost}"

        cmd=(
          nixos-rebuild
          switch
          --flake
          ".#eulesia-test"
          --target-host
          "$TARGET_USER@$TARGET_HOST"
        )

        if [ -n "$BUILD_HOST" ] && [ "$BUILD_HOST" != "localhost" ]; then
          cmd+=(
            --build-host
            "$BUILD_HOST"
          )
        fi

        exec "''${cmd[@]}" "$@"
      '';
    };

    bootstrapTest = pkgs.writeShellApplication {
      name = "eulesia-bootstrap-test";
      runtimeInputs = with pkgs; [
        coreutils
        openssh
        nixos-anywhere
      ];
      text = ''
        set -euo pipefail

        TARGET_HOST="''${EULESIA_TEST_TARGET_HOST:-eulesia-server-test}"
        TARGET_USER="''${EULESIA_TEST_SSH_USER:-root}"

        echo "This will wipe the system disk and PostgreSQL volume on $TARGET_USER@$TARGET_HOST."
        echo "It installs the minimal eulesia-test-bootstrap configuration with disko."
        printf "Continue with bootstrap installation? (yes/no): "
        read -r confirmation

        if [ "$confirmation" != "yes" ]; then
          echo "Bootstrap installation cancelled."
          exit 0
        fi

        if [ -z "''${NIX_SSHOPTS:-}" ]; then
          export NIX_SSHOPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
        fi

        exec ${nixos-anywhere}/bin/nixos-anywhere \
          --flake ".#eulesia-test-bootstrap" \
          "$@" \
          "$TARGET_USER@$TARGET_HOST"
      '';
    };

    getTestAgeKey = pkgs.writeShellApplication {
      name = "eulesia-get-test-age-key";
      runtimeInputs = with pkgs; [
        coreutils
        openssh
      ];
      text = ''
        set -euo pipefail

        TARGET_HOST="''${EULESIA_TEST_TARGET_HOST:-eulesia-server-test}"
        TARGET_USER="''${EULESIA_TEST_SSH_USER:-root}"

        exec ssh \
          -o StrictHostKeyChecking=no \
          -o UserKnownHostsFile=/dev/null \
          "$TARGET_USER@$TARGET_HOST" \
          "age-keygen -y /var/lib/sops-nix/key.txt"
      '';
    };

    rebuildProd = pkgs.writeShellApplication {
      name = "eulesia-rebuild-prod";
      runtimeInputs = with pkgs; [
        coreutils
        nix
        nixos-rebuild
        openssh
      ];
      text = ''
        set -euo pipefail

        TARGET_HOST="''${EULESIA_PROD_TARGET_HOST:-eulesia-server-prod}"
        TARGET_USER="''${EULESIA_PROD_SSH_USER:-root}"
        BUILD_HOST="''${EULESIA_PROD_BUILD_HOST:-localhost}"

        cmd=(
          nixos-rebuild
          switch
          --flake
          ".#eulesia-prod"
          --target-host
          "$TARGET_USER@$TARGET_HOST"
        )

        if [ -n "$BUILD_HOST" ] && [ "$BUILD_HOST" != "localhost" ]; then
          cmd+=(
            --build-host
            "$BUILD_HOST"
          )
        fi

        exec "''${cmd[@]}" "$@"
      '';
    };

    bootstrapProd = pkgs.writeShellApplication {
      name = "eulesia-bootstrap-prod";
      runtimeInputs = with pkgs; [
        coreutils
        openssh
        nixos-anywhere
      ];
      text = ''
        set -euo pipefail

        TARGET_HOST="''${EULESIA_PROD_TARGET_HOST:-eulesia-server-prod}"
        TARGET_USER="''${EULESIA_PROD_SSH_USER:-root}"

        echo "This will wipe the system disk and PostgreSQL volume on $TARGET_USER@$TARGET_HOST."
        echo "It installs the minimal eulesia-prod-bootstrap configuration with disko."
        printf "Continue with bootstrap installation? (yes/no): "
        read -r confirmation

        if [ "$confirmation" != "yes" ]; then
          echo "Bootstrap installation cancelled."
          exit 0
        fi

        if [ -z "''${NIX_SSHOPTS:-}" ]; then
          export NIX_SSHOPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
        fi

        exec ${nixos-anywhere}/bin/nixos-anywhere \
          --flake ".#eulesia-prod-bootstrap" \
          "$@" \
          "$TARGET_USER@$TARGET_HOST"
      '';
    };

    getProdAgeKey = pkgs.writeShellApplication {
      name = "eulesia-get-prod-age-key";
      runtimeInputs = with pkgs; [
        coreutils
        openssh
      ];
      text = ''
        set -euo pipefail

        TARGET_HOST="''${EULESIA_PROD_TARGET_HOST:-eulesia-server-prod}"
        TARGET_USER="''${EULESIA_PROD_SSH_USER:-root}"

        exec ssh \
          -o StrictHostKeyChecking=no \
          -o UserKnownHostsFile=/dev/null \
          "$TARGET_USER@$TARGET_HOST" \
          "age-keygen -y /var/lib/sops-nix/key.txt"
      '';
    };

    auditProdSecrets = pkgs.writeShellApplication {
      name = "eulesia-audit-prod-secrets";
      runtimeInputs = with pkgs; [
        coreutils
        gnugrep
        jq
        sops
      ];
      text = ''
        set -euo pipefail

        shopt -s nullglob
        files=(secrets/prod/*.enc)

        if [ "''${#files[@]}" -eq 0 ]; then
          echo "No encrypted production secrets found under secrets/prod/."
          exit 1
        fi

        failures=0

        for file in "''${files[@]}"; do
          content="$(sops -d "$file")"
          compact="$(printf '%s' "$content" | tr -d '\n\r\t ')"
          status="ok"
          reason=""

          if [ -z "$compact" ]; then
            status="placeholder"
            reason="empty value"
          elif printf '%s' "$compact" | grep -Eq '^(REPLACE_WITH_|replace-with-)'; then
            status="placeholder"
            reason="replace-with placeholder"
          elif printf '%s' "$content" | jq -e 'type == "object" and length == 0' >/dev/null 2>&1; then
            status="placeholder"
            reason="empty JSON object"
          fi

          printf '%-52s %s' "$file" "$status"
          if [ -n "$reason" ]; then
            printf ' (%s)' "$reason"
          fi
          printf '\n'

          if [ "$status" != "ok" ]; then
            failures=1
          fi
        done

        if [ "$failures" -ne 0 ]; then
          echo
          echo "Production secrets still contain obvious placeholders."
          echo "Replace the flagged values before cutting over production services."
          exit 1
        fi
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

      rebuild-test = {
        type = "app";
        program = "${rebuildTest}/bin/eulesia-rebuild-test";
        meta.description = "Deploy the Eulesia test NixOS configuration with nixos-rebuild";
      };

      bootstrap-test = {
        type = "app";
        program = "${bootstrapTest}/bin/eulesia-bootstrap-test";
        meta.description = "Install the Eulesia test bootstrap NixOS configuration with nixos-anywhere";
      };

      get-test-age-key = {
        type = "app";
        program = "${getTestAgeKey}/bin/eulesia-get-test-age-key";
        meta.description = "Fetch the test host age public key after bootstrap";
      };

      rebuild-prod = {
        type = "app";
        program = "${rebuildProd}/bin/eulesia-rebuild-prod";
        meta.description = "Deploy the Eulesia production NixOS configuration with nixos-rebuild";
      };

      bootstrap-prod = {
        type = "app";
        program = "${bootstrapProd}/bin/eulesia-bootstrap-prod";
        meta.description = "Install the Eulesia production bootstrap NixOS configuration with nixos-anywhere";
      };

      get-prod-age-key = {
        type = "app";
        program = "${getProdAgeKey}/bin/eulesia-get-prod-age-key";
        meta.description = "Fetch the production host age public key after bootstrap";
      };

      audit-prod-secrets = {
        type = "app";
        program = "${auditProdSecrets}/bin/eulesia-audit-prod-secrets";
        meta.description = "Decrypt and audit production secrets for obvious placeholder values";
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
          inputs.disko.nixosModules.disko
          inputs.sops-nix.nixosModules.sops
          ../hosts/eulesia-prod.nix
        ];
      };

      eulesia-prod-bootstrap = inputs.nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        specialArgs = {
          inherit inputs;
        };
        modules = [
          inputs.disko.nixosModules.disko
          ../hosts/eulesia-prod-bootstrap.nix
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
          inputs.disko.nixosModules.disko
          inputs.sops-nix.nixosModules.sops
          ../hosts/eulesia-test.nix
        ];
      };

      eulesia-test-bootstrap = inputs.nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        specialArgs = {
          inherit inputs;
        };
        modules = [
          inputs.disko.nixosModules.disko
          ../hosts/eulesia-test-bootstrap.nix
        ];
      };
    };

    deploy.nodes.eulesia-prod = {
      hostname = "eulesia.org";
      sshUser = "root";
      fastConnection = true;
      profiles.system = {
        user = "root";
        path = inputs.deploy-rs.lib.x86_64-linux.activate.nixos inputs.self.nixosConfigurations.eulesia-prod;
      };
    };

    deploy.nodes.eulesia-test = {
      hostname = "eulesia-server-test";
      sshUser = "root";
      fastConnection = true;
      profiles.system = {
        user = "root";
        path = inputs.deploy-rs.lib.x86_64-linux.activate.nixos inputs.self.nixosConfigurations.eulesia-test;
      };
    };
  };
}
