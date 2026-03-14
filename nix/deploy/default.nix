{inputs, ...}: {
  perSystem = {
    lib,
    pkgs,
    system,
    ...
  }: let
    deploy-rs = inputs.deploy-rs.packages.${system}.default;
  in {
    apps = lib.optionalAttrs (system == "x86_64-linux") {
      deploy = {
        type = "app";
        program = "${pkgs.writeShellScript "eulesia-deploy" ''
          set -euo pipefail
          SSH_TARGET="root@95.216.206.136"
          SOPS_AGE_KEY_FILE="''${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}"

          if [ -f "$SOPS_AGE_KEY_FILE" ]; then
            echo "Installing sops age key on $SSH_TARGET..."
            ${pkgs.openssh}/bin/ssh "$SSH_TARGET" "install -d -m 700 /var/lib/sops-nix"
            cat "$SOPS_AGE_KEY_FILE" \
              | ${pkgs.openssh}/bin/ssh "$SSH_TARGET" \
                  "cat > /var/lib/sops-nix/key.txt && chmod 600 /var/lib/sops-nix/key.txt && chown root:root /var/lib/sops-nix/key.txt"
          else
            echo "No local sops age key found at $SOPS_AGE_KEY_FILE; assuming /var/lib/sops-nix/key.txt already exists on $SSH_TARGET"
          fi

          exec ${deploy-rs}/bin/deploy .#eulesia-prod "$@"
        ''}";
        meta.description = "Deploy the Eulesia production NixOS configuration with deploy-rs";
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
          ../hosts/eulesia-vm.nix
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
  };
}
