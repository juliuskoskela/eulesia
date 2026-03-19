{inputs, ...}: {
  perSystem = {
    lib,
    pkgs,
    system,
    ...
  }: let
    deploy-rs = inputs.deploy-rs.packages.${system}.default;

    runMicrovm =
      pkgs.writeShellApplication {
        name = "eulesia-run-microvm";
        runtimeInputs = with pkgs; [
          coreutils
          gnugrep
          iproute2
          nix
          openssh
        ];
        text = ''
          set -euo pipefail

          SSH_BIN=${pkgs.openssh}/bin/ssh
          QEMU_PID=""
          SSH_OPTS=(
            -p 2223
            -o BatchMode=yes
            -o ConnectTimeout=2
            -o StrictHostKeyChecking=no
            -o UserKnownHostsFile=/dev/null
          )
          SOPS_AGE_KEY_FILE="''${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}"
          BOOTSTRAP_PID=""

          echo "Starting the Eulesia MicroVM..."
          echo ""
          echo "Access:"
          echo "  - App + API: http://localhost:18080"
          echo "  - Meilisearch: http://localhost:17701/health"
          echo "  - PostgreSQL: localhost:15433"
          echo "  - SSH: ssh root@localhost -p 2223"
          echo ""
          echo "The VM will try to bootstrap /var/lib/sops-nix/key.txt from:"
          echo "  $SOPS_AGE_KEY_FILE"
          echo ""
          echo "Press Ctrl+A then X to exit QEMU, or Ctrl+C to stop."
          echo ""

          if ss -ltn "( sport = :18080 or sport = :2223 or sport = :15433 or sport = :17701 )" | tail -n +2 | grep -q .; then
            echo "One or more required localhost ports are already in use:"
            ss -ltnp "( sport = :18080 or sport = :2223 or sport = :15433 or sport = :17701 )" || true
            exit 1
          fi

          RUNNER=$(nix build .#nixosConfigurations.eulesia-vm.config.microvm.runner.qemu --print-out-paths --no-link)

          bootstrap_vm() {
            if [ ! -f "$SOPS_AGE_KEY_FILE" ]; then
              echo "No local sops age key found at $SOPS_AGE_KEY_FILE."
              echo "Run just vm-deploy after making that file available."
              return 0
            fi

            echo "Waiting for SSH on localhost:2223..."
            ATTEMPT=0
            until "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost true >/dev/null 2>&1; do
              ATTEMPT=$((ATTEMPT + 1))
              if [ "$ATTEMPT" -ge 60 ]; then
                echo "SSH did not become ready in time; skipping automatic activation."
                return 0
              fi
              sleep 1
            done

            echo "Installing local sops age key into the VM..."
            "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost "install -d -m 700 /var/lib/sops-nix"
            cat "$SOPS_AGE_KEY_FILE" \
              | "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost \
                  "cat > /var/lib/sops-nix/key.txt && chmod 600 /var/lib/sops-nix/key.txt && chown root:root /var/lib/sops-nix/key.txt"

            echo "Activating the current Eulesia VM configuration..."
            SYSTEM_PATH=$(nix build .#nixosConfigurations.eulesia-vm.config.system.build.toplevel --print-out-paths --no-link)
            "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost \
              "nix-env -p /nix/var/nix/profiles/system --set '$SYSTEM_PATH' && /nix/var/nix/profiles/system/bin/switch-to-configuration switch"

            echo "VM services activated."
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

    deployVm =
      pkgs.writeShellApplication {
        name = "eulesia-deploy-vm";
        runtimeInputs = with pkgs; [
          coreutils
          nix
          openssh
        ];
        text = ''
          set -euo pipefail

          SSH_BIN=${pkgs.openssh}/bin/ssh
          SSH_OPTS=(
            -p 2223
            -o BatchMode=yes
            -o ConnectTimeout=2
            -o StrictHostKeyChecking=no
            -o UserKnownHostsFile=/dev/null
          )
          SOPS_AGE_KEY_FILE="''${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}"

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

          echo "Building the Eulesia VM system..."
          SYSTEM_PATH=$(nix build .#nixosConfigurations.eulesia-vm.config.system.build.toplevel --print-out-paths --no-link)
          echo "System path: $SYSTEM_PATH"

          wait_for_ssh

          if [ -f "$SOPS_AGE_KEY_FILE" ]; then
            echo "Installing local sops age key into the VM..."
            "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost "install -d -m 700 /var/lib/sops-nix"
            cat "$SOPS_AGE_KEY_FILE" \
              | "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost \
                  "cat > /var/lib/sops-nix/key.txt && chmod 600 /var/lib/sops-nix/key.txt && chown root:root /var/lib/sops-nix/key.txt"
          else
            echo "No local sops age key found at $SOPS_AGE_KEY_FILE."
            echo "Assuming the VM already has a matching /var/lib/sops-nix/key.txt."
          fi

          echo "Switching the running VM configuration..."
          "$SSH_BIN" "''${SSH_OPTS[@]}" root@localhost \
            "nix-env -p /nix/var/nix/profiles/system --set '$SYSTEM_PATH' && /nix/var/nix/profiles/system/bin/switch-to-configuration switch"

          echo "Deployment complete."
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
        meta.description = "Run the local Eulesia MicroVM and expose app, SSH, PostgreSQL, and Meilisearch on localhost";
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
