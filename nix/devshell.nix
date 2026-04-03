{inputs, ...}: {
  perSystem = {
    config,
    pkgs,
    ...
  }: let
    commonPackages = with pkgs; [
      nodejs_22
      pnpm_10
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

    playwrightBrowsers = pkgs.playwright-driver.browsers;
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
            inputs.nixos-anywhere.packages.${pkgs.system}.nixos-anywhere
            playwrightBrowsers
          ];

        shellHook = ''
          ${config.pre-commit.installationScript or ""}

          export PLAYWRIGHT_BROWSERS_PATH="${playwrightBrowsers}"
          export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

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
            just bootstrap-test
            just get-test-age-key
            just rebuild-test
            just vm-run
            just vm-deploy
            nix build .#nixosConfigurations.eulesia-vm.config.microvm.runner.qemu
            nix build .#nixosConfigurations.eulesia-test-bootstrap.config.system.build.toplevel
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
            pkgs.gnumake
            pkgs.gcc
            playwrightBrowsers
          ];
        shellHook = ''
          export PLAYWRIGHT_BROWSERS_PATH="${playwrightBrowsers}"
          export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
        '';
      };
    };
  };
}
