{ ... }:
{
  perSystem = { config, pkgs, ... }: {
    treefmt = {
      projectRootFile = "flake.nix";

      programs = {
        alejandra.enable = true;
      };

      settings = {
        global = {
          excludes = [
            ".git/*"
            "node_modules/*"
            "apps/api/node_modules/*"
            "dist/*"
            "apps/api/dist/*"
            "result*"
            "flake.lock"
            "package-lock.json"
            "apps/api/package-lock.json"
          ];
        };
      };
    };

    formatter = config.treefmt.build.wrapper;

    packages.fmt-check = pkgs.writeShellApplication {
      name = "fmt-check";
      runtimeInputs = [ config.treefmt.build.wrapper ];
      text = ''
        set -euo pipefail
        treefmt --fail-on-change
      '';
    };
  };
}
