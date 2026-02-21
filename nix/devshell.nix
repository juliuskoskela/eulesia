_: {
  perSystem = {
    config,
    pkgs,
    ...
  }: {
    devShells.default = pkgs.mkShell {
      name = "eulesia-dev";

      packages = with pkgs; [
        nodejs_20
        jq
        jose
        statix
        deadnix
        config.treefmt.build.wrapper
        config.packages.generate-idura-jwks
        config.packages.fmt-check
        config.packages.lint
        config.packages.lint-nix
      ];

      shellHook = ''
        ${config.pre-commit.installationScript or ""}

        echo "Eulesia dev shell ready."
        echo ""
        echo "Builds:"
        echo "  nix build .#frontend"
        echo "  nix build .#api"
        echo "  nix build .#build"
        echo ""
        echo "Tooling:"
        echo "  nix fmt"
        echo "  lint-nix"
        echo "  lint-web"
        echo "  lint"
        echo "  generate-idura-jwks [output-directory]"
      '';
    };
  };
}
