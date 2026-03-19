_: {
  perSystem = {
    config,
    pkgs,
    ...
  }: let
    commonPackages = with pkgs; [
      nodejs_22
      just
      process-compose
      git
      jq
      ripgrep
      fd
      curl
      sops
      age
      postgresql_16
      meilisearch
      python3
      pkg-config
      vips
      libargon2
      statix
      deadnix
      config.treefmt.build.wrapper
    ];
  in {
    devShells = {
      default = pkgs.mkShell {
        name = "eulesia-dev";

        packages =
          commonPackages
          ++ [
            config.packages.dev
            config.packages.dev-api
            config.packages.dev-web
            config.packages.db-migrate
            config.packages.db-reset
            config.packages.check-format
            config.packages.lint
            config.packages.test
            config.packages.ci-check
            config.packages.generate-idura-jwks
          ];

        shellHook = ''
          ${config.pre-commit.installationScript or ""}

          cat <<'EOF'
          Eulesia development shell
          ========================

          Primary workflow:
            just dev
            just lint
            just test
            just build

          Useful commands:
            nix run .#db-migrate
            nix run .#db-reset
            just vm-run
            just vm-deploy
            nix build .#nixosConfigurations.eulesia-vm.config.microvm.runner.qemu
            nix build .#nixosConfigurations.eulesia-test.config.system.build.toplevel
          EOF
        '';
      };

      ci = pkgs.mkShell {
        name = "eulesia-ci";
        packages =
          commonPackages
          ++ [
            config.packages.check-format
            config.packages.lint
            config.packages.test
            config.packages.ci-check
          ];
        shellHook = "";
      };
    };
  };
}
