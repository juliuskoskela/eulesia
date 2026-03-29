default:
    @just --list

help: default

dev:
    nix run .#dev

dev-api:
    nix run .#dev-api

dev-web:
    nix run .#dev-web

db-migrate:
    nix run .#db-migrate

db-reset:
    nix run .#db-reset

fmt:
    nix fmt

check-format:
    nix run .#check-format

lint:
    nix run .#lint

test:
    nix run .#test

build:
    nix build .#build

build-api:
    nix build .#api

build-web:
    nix build .#frontend

ci-check:
    nix run .#ci-check

vm-build:
    nix build .#nixosConfigurations.eulesia-vm.config.microvm.runner.qemu

vm-run:
    nix run .#microvm

vm-deploy:
    nix run .#deploy-vm

generate-idura-jwks out_dir="local/idura-jwks":
    nix run .#generate-idura-jwks -- {{out_dir}}

test-host-build:
    nix build .#nixosConfigurations.eulesia-test.config.system.build.toplevel

test-host-bootstrap-build:
    nix build .#nixosConfigurations.eulesia-test-bootstrap.config.system.build.toplevel

prod-host-build:
    nix build .#nixosConfigurations.eulesia-prod.config.system.build.toplevel

prod-host-bootstrap-build:
    nix build .#nixosConfigurations.eulesia-prod-bootstrap.config.system.build.toplevel

deploy:
    nix run .#deploy

deploy-test:
    nix run .#deploy-test

rebuild-prod:
    nix run .#rebuild-prod

bootstrap-prod:
    nix run .#bootstrap-prod

get-prod-age-key:
    nix run .#get-prod-age-key

audit-prod-secrets:
    nix run .#audit-prod-secrets

rebuild-test:
    nix run .#rebuild-test

bootstrap-test:
    nix run .#bootstrap-test

get-test-age-key:
    nix run .#get-test-age-key

shell:
    nix develop

ci-shell:
    nix develop .#ci
