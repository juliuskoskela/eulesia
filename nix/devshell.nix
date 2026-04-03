{inputs, ...}: {
  perSystem = {
    config,
    pkgs,
    system,
    ...
  }: let
    rustToolchain = pkgs.rust-bin.stable.latest.default.override {
      extensions = ["rust-src" "rust-analyzer"];
    };
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
      rustToolchain
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

          Eulesia Development Shell
          ═════════════════════════

          Dev workflow        Deploy & infra
          ──────────────      ──────────────────────
          just dev            just rebuild-test
          just lint           just rebuild-prod
          just test           just deploy-test
          just build          just bootstrap-test

          E2E testing         Database
          ──────────────      ──────────────────────
          just test-e2e       just db-migrate
          just test-e2e-ui    just db-reset

          Tools: node ${pkgs.nodejs_22.version} | pnpm ${pkgs.pnpm_10.version} | pg ${pkgs.postgresql_16.version}

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
