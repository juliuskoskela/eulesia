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
    nix build .#nixosConfigurations.eulesia-vm.config.system.build.vm

deploy:
    nix run .#deploy

shell:
    nix develop

ci-shell:
    nix develop .#ci
