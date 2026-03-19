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
