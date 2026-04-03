_: {
  perSystem = {
    config,
    pkgs,
    ...
  }: {
    treefmt = {
      projectRootFile = "flake.nix";

      programs = {
        alejandra.enable = true;
        prettier.enable = true;
        shfmt.enable = true;
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
            "pnpm-lock.yaml"
          ];
        };
      };
    };

    formatter = config.treefmt.build.wrapper;

    packages.fmt-check = pkgs.writeShellApplication {
      name = "fmt-check";
      runtimeInputs = [config.treefmt.build.wrapper];
      text = ''
        set -euo pipefail
        HOME="$(mktemp -d)"
        export HOME
        XDG_CACHE_HOME="$HOME/.cache"
        export XDG_CACHE_HOME
        mkdir -p "$XDG_CACHE_HOME"
        treefmt --fail-on-change
      '';
    };
  };
}
