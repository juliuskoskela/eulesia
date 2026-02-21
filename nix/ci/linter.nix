{ ... }:
{
  perSystem = { config, pkgs, ... }:
    let
      lintNix = pkgs.writeShellApplication {
        name = "lint-nix";
        runtimeInputs = with pkgs; [ statix deadnix ];
        text = ''
          set -euo pipefail

          statix check flake.nix nix
          deadnix --fail flake.nix nix
        '';
      };

      lintWeb = pkgs.writeShellApplication {
        name = "lint-web";
        runtimeInputs = [ pkgs.nodejs_20 ];
        text = ''
          set -euo pipefail

          npm ci --silent
          npm run lint
        '';
      };
    in
    {
      pre-commit = {
        check.enable = true;
        settings = {
          hooks = {
            flake-check = {
              enable = true;
              name = "flake-check";
              language = "system";
              pass_filenames = false;
              entry = "${pkgs.writeShellScript "flake-check" ''
                nix flake check --no-build 2>&1 | grep -v "warning: Git tree"
              ''}";
            };

            lint-nix = {
              enable = true;
              name = "lint-nix";
              language = "system";
              pass_filenames = false;
              entry = "${lintNix}/bin/lint-nix";
            };
          };
        };
      };

      packages = {
        lint-nix = lintNix;
        lint-web = lintWeb;
        lint = pkgs.writeShellApplication {
          name = "lint";
          runtimeInputs = [ lintNix lintWeb ];
          text = ''
            set -euo pipefail

            lint-nix
            lint-web
          '';
        };
      };
    };
}
