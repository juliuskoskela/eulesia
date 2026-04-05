_: {
  perSystem = {
    config,
    pkgs,
    ...
  }: let
    # Use the same Rust toolchain as the server build so rustfmt output matches.
    rustToolchain = pkgs.rust-bin.stable.latest.default;
  in {
    treefmt = {
      projectRootFile = "flake.nix";

      programs = {
        alejandra.enable = true;
        prettier.enable = true;
        rustfmt = {
          enable = true;
          package = rustToolchain;
        };
        shfmt.enable = true;
      };

      settings = {
        global = {
          excludes = [
            ".git/*"
            "node_modules/*"
            "dist/*"
            "result*"
            "flake.lock"
            "Cargo.lock"
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
