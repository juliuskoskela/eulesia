_: {
  perSystem = {
    lib,
    pkgs,
    ...
  }: let
    repoRoot = toString ../.;
    nodejs = pkgs.nodejs_22;
    postgres = pkgs.postgresql_16;

    shellFunctions = ''
      repo_root=${lib.escapeShellArg repoRoot}
      cd "$repo_root"
      export REPO_ROOT="$repo_root"

      load_local_env() {
        local env_file
        for env_file in \
          ".env.local" \
          ".env.development.local" \
          "apps/api/.env.local" \
          "apps/api/.env.development.local"
        do
          if [ -f "$env_file" ]; then
            set -a
            # shellcheck source=/dev/null
            . "$env_file"
            set +a
          fi
        done
      }

      configure_dev_env() {
        load_local_env

        export EULESIA_DEV_STATE_DIR="''${EULESIA_DEV_STATE_DIR:-$REPO_ROOT/.eulesia/state}"
        export EULESIA_PGDATA_DIR="''${EULESIA_PGDATA_DIR:-$EULESIA_DEV_STATE_DIR/postgres}"
        export EULESIA_PGPORT="''${EULESIA_PGPORT:-5432}"
        export EULESIA_DB_USER="''${EULESIA_DB_USER:-eulesia}"
        export EULESIA_DB_NAME="''${EULESIA_DB_NAME:-eulesia}"
        export EULESIA_MEILI_PORT="''${EULESIA_MEILI_PORT:-7700}"
        export EULESIA_MEILI_URL="''${EULESIA_MEILI_URL:-http://127.0.0.1:$EULESIA_MEILI_PORT}"
        export EULESIA_MEILI_MASTER_KEY="''${EULESIA_MEILI_MASTER_KEY:-development-meili-key-change-in-prod}"
        export EULESIA_MEILI_DATA_DIR="''${EULESIA_MEILI_DATA_DIR:-$EULESIA_DEV_STATE_DIR/meilisearch}"
        export EULESIA_UPLOAD_DIR="''${EULESIA_UPLOAD_DIR:-$EULESIA_DEV_STATE_DIR/uploads}"
        export APP_URL="''${APP_URL:-http://localhost:5173}"
        export API_URL="''${API_URL:-http://localhost:3001}"
        export PORT="''${PORT:-3001}"
        export SESSION_SECRET="''${SESSION_SECRET:-development-secret-key-change-in-production-32chars}"
        export ALLOWED_ORIGINS="''${ALLOWED_ORIGINS:-capacitor://localhost,https://localhost}"
        export DATABASE_URL="''${DATABASE_URL:-postgresql://$EULESIA_DB_USER:eulesia@127.0.0.1:$EULESIA_PGPORT/$EULESIA_DB_NAME}"
        export MEILI_URL="''${MEILI_URL:-$EULESIA_MEILI_URL}"
        export MEILI_MASTER_KEY="''${MEILI_MASTER_KEY:-$EULESIA_MEILI_MASTER_KEY}"
        export UPLOAD_DIR="''${UPLOAD_DIR:-$EULESIA_UPLOAD_DIR}"
        export NODE_ENV="''${NODE_ENV:-development}"
        export VITE_API_URL="''${VITE_API_URL:-$API_URL}"

        mkdir -p "$EULESIA_DEV_STATE_DIR" "$EULESIA_UPLOAD_DIR"
      }

      ensure_dependencies() {
        if [ ! -f node_modules/.package-lock.json ] || ! cmp -s package-lock.json node_modules/.package-lock.json >/dev/null 2>&1; then
          echo "Installing npm dependencies..."
          npm ci
        fi
      }

      wait_for_postgres() {
        for _ in $(seq 1 60); do
          if pg_isready -h 127.0.0.1 -p "$EULESIA_PGPORT" >/dev/null 2>&1; then
            return 0
          fi
          sleep 1
        done
        echo "PostgreSQL did not become ready on port $EULESIA_PGPORT" >&2
        return 1
      }

      wait_for_http() {
        local url="$1"
        for _ in $(seq 1 60); do
          if curl --silent --fail "$url" >/dev/null 2>&1; then
            return 0
          fi
          sleep 1
        done
        echo "HTTP endpoint did not become ready: $url" >&2
        return 1
      }

      bootstrap_postgres() {
        mkdir -p "$EULESIA_PGDATA_DIR"

        if [ ! -f "$EULESIA_PGDATA_DIR/PG_VERSION" ]; then
          initdb \
            --username="$EULESIA_DB_USER" \
            --auth-local=trust \
            --auth-host=trust \
            --pgdata="$EULESIA_PGDATA_DIR"
        fi

        if [ ! -f "$EULESIA_PGDATA_DIR/.eulesia-bootstrapped" ]; then
          pg_ctl \
            -D "$EULESIA_PGDATA_DIR" \
            -l "$EULESIA_DEV_STATE_DIR/postgres-bootstrap.log" \
            -o "-F -h 127.0.0.1 -p $EULESIA_PGPORT" \
            -w start

          psql -h 127.0.0.1 -p "$EULESIA_PGPORT" -U "$EULESIA_DB_USER" postgres \
            -tc "SELECT 1 FROM pg_database WHERE datname = '$EULESIA_DB_NAME'" \
            | grep -q 1 \
            || createdb -h 127.0.0.1 -p "$EULESIA_PGPORT" -U "$EULESIA_DB_USER" "$EULESIA_DB_NAME"

          touch "$EULESIA_PGDATA_DIR/.eulesia-bootstrapped"
          pg_ctl -D "$EULESIA_PGDATA_DIR" -m fast stop
        fi
      }
    '';

    postgresService = pkgs.writeShellApplication {
      name = "eulesia-postgres-service";
      runtimeInputs = [postgres];
      text = ''
        set -euo pipefail
        ${shellFunctions}
        configure_dev_env
        bootstrap_postgres

        exec postgres \
          -D "$EULESIA_PGDATA_DIR" \
          -F \
          -h 127.0.0.1 \
          -p "$EULESIA_PGPORT"
      '';
    };

    meilisearchService = pkgs.writeShellApplication {
      name = "eulesia-meilisearch-service";
      runtimeInputs = [pkgs.meilisearch];
      text = ''
        set -euo pipefail
        ${shellFunctions}
        configure_dev_env
        mkdir -p "$EULESIA_MEILI_DATA_DIR"

        exec meilisearch \
          --env development \
          --http-addr "127.0.0.1:$EULESIA_MEILI_PORT" \
          --master-key "$EULESIA_MEILI_MASTER_KEY" \
          --db-path "$EULESIA_MEILI_DATA_DIR"
      '';
    };

    devWeb = pkgs.writeShellApplication {
      name = "eulesia-dev-web";
      runtimeInputs = [nodejs];
      text = ''
        set -euo pipefail
        ${shellFunctions}
        configure_dev_env
        ensure_dependencies

        exec npm run dev -- --host 0.0.0.0
      '';
    };

    dbMigrate = pkgs.writeShellApplication {
      name = "eulesia-db-migrate";
      runtimeInputs = [nodejs postgres pkgs.curl];
      text = ''
        set -euo pipefail
        ${shellFunctions}
        configure_dev_env
        ensure_dependencies
        wait_for_postgres

        exec npm run db:push --workspace=@eulesia/api
      '';
    };

    devApi = pkgs.writeShellApplication {
      name = "eulesia-dev-api";
      runtimeInputs = [nodejs postgres pkgs.curl dbMigrate];
      text = ''
        set -euo pipefail
        ${shellFunctions}
        configure_dev_env
        ensure_dependencies
        wait_for_postgres
        wait_for_http "$MEILI_URL/health"
        mkdir -p "$UPLOAD_DIR"
        ${dbMigrate}/bin/eulesia-db-migrate

        exec npm run dev --workspace=@eulesia/api
      '';
    };

    dbReset = pkgs.writeShellApplication {
      name = "eulesia-db-reset";
      runtimeInputs = [postgres dbMigrate];
      text = ''
        set -euo pipefail
        ${shellFunctions}
        configure_dev_env

        if pg_ctl -D "$EULESIA_PGDATA_DIR" status >/dev/null 2>&1; then
          pg_ctl -D "$EULESIA_PGDATA_DIR" -m fast stop
        fi

        rm -rf "$EULESIA_PGDATA_DIR"
        bootstrap_postgres
        pg_ctl \
          -D "$EULESIA_PGDATA_DIR" \
          -l "$EULESIA_DEV_STATE_DIR/postgres-bootstrap.log" \
          -o "-F -h 127.0.0.1 -p $EULESIA_PGPORT" \
          -w start

        trap 'pg_ctl -D "$EULESIA_PGDATA_DIR" -m fast stop >/dev/null 2>&1 || true' EXIT
        ${dbMigrate}/bin/eulesia-db-migrate
      '';
    };

    processComposeConfig = pkgs.writeText "eulesia-process-compose.yaml" ''
      version: "0.5"
      processes:
        postgres:
          command: ${lib.escapeShellArg "${postgresService}/bin/eulesia-postgres-service"}
        meilisearch:
          command: ${lib.escapeShellArg "${meilisearchService}/bin/eulesia-meilisearch-service"}
        api:
          command: ${lib.escapeShellArg "${devApi}/bin/eulesia-dev-api"}
        web:
          command: ${lib.escapeShellArg "${devWeb}/bin/eulesia-dev-web"}
    '';

    dev = pkgs.writeShellApplication {
      name = "eulesia-dev";
      runtimeInputs = [pkgs.process-compose];
      text = ''
        set -euo pipefail
        cd ${lib.escapeShellArg repoRoot}
        exec process-compose -f ${lib.escapeShellArg (toString processComposeConfig)} up
      '';
    };
  in {
    packages = {
      inherit dev;
      dev-api = devApi;
      dev-web = devWeb;
      db-migrate = dbMigrate;
      db-reset = dbReset;
    };

    apps = {
      dev = {
        type = "app";
        program = "${dev}/bin/eulesia-dev";
        meta.description = "Start PostgreSQL, Meilisearch, API, and frontend for local development";
      };
      dev-api = {
        type = "app";
        program = "${devApi}/bin/eulesia-dev-api";
        meta.description = "Start the API against locally managed PostgreSQL and Meilisearch";
      };
      dev-web = {
        type = "app";
        program = "${devWeb}/bin/eulesia-dev-web";
        meta.description = "Start the Vite frontend development server";
      };
      db-migrate = {
        type = "app";
        program = "${dbMigrate}/bin/eulesia-db-migrate";
        meta.description = "Apply local database schema changes with Drizzle";
      };
      db-reset = {
        type = "app";
        program = "${dbReset}/bin/eulesia-db-reset";
        meta.description = "Recreate the local PostgreSQL cluster and apply schema changes";
      };
    };
  };
}
