{
  config,
  eulesiaPackages,
  lib,
  pkgs,
  ...
}: {
  imports = [
    ../modules/eulesia.nix
  ];

  networking.hostName = "eulesia-vm";
  networking.firewall.enable = true;
  networking.firewall.allowedTCPPorts = [
    22
    5432
    7700
  ];

  microvm = {
    hypervisor = "qemu";
    vcpu = 2;
    mem = 4096;
    shares = [
      {
        proto = "virtiofs";
        tag = "ro-store";
        source = "/nix/store";
        mountPoint = "/nix/.ro-store";
      }
    ];
    writableStoreOverlay = "/nix/.rw-store";
    volumes = [
      {
        mountPoint = "/var";
        image = "var.img";
        size = 8 * 1024;
      }
    ];
    interfaces = [
      {
        type = "user";
        id = "vm-eulesia";
        mac = "02:00:00:01:02:01";
      }
    ];
    forwardPorts = [
      {
        from = "host";
        host.port = 18080;
        guest.port = 80;
      }
      {
        from = "host";
        host.port = 2223;
        guest.port = 22;
      }
      {
        from = "host";
        host.port = 15433;
        guest.port = 5432;
      }
      {
        from = "host";
        host.port = 17701;
        guest.port = 7700;
      }
    ];
  };

  sops = {
    age = {
      keyFile = "/var/lib/sops-nix/key.txt";
      generateKey = true;
    };
    secrets = import ./lib/eulesia-secrets.nix {
      inherit config;
      secretDir = ../../secrets/test;
    };
  };

  services.openssh = {
    enable = true;
    settings = {
      KbdInteractiveAuthentication = false;
      PasswordAuthentication = false;
      PermitRootLogin = "prohibit-password";
    };
  };

  users.users.root = {
    initialPassword = "test";
    openssh.authorizedKeys.keys = [
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIP1USfplYAtcR/hCxKmnypsJpqbU51DezXQgKFZ/lCax"
    ];
  };

  services.postgresql = {
    authentication = lib.mkForce ''
      local all all trust
      host all all 127.0.0.1/32 trust
      host all all ::1/128 trust
      host all all 10.0.2.0/24 trust
    '';
    settings.listen_addresses = lib.mkForce "*";
  };

  services.eulesia = {
    enable = true;
    package = eulesiaPackages.api;
    frontendPackage = eulesiaPackages.frontend;
    appDomain = "localhost";
    apiDomain = "api.localhost";
    tls.enable = false;
    tls.acmeEmail = null;
    email = {
      provider = "smtp";
      from = "noreply@aihiolabs.com";
      smtp = {
        host = "mail.infomaniak.com";
        port = 587;
        secure = false;
      };
    };
    auth.sessionSecretFile = config.sops.secrets."session-secret".path;
    meilisearch = {
      listenAddress = "0.0.0.0";
      masterKeyFile = config.sops.secrets."meili-master-key".path;
    };
    ai.mistralApiKeyFile = config.sops.secrets."mistral-api-key".path;
    email.smtp.userFile = config.sops.secrets."smtp-user".path;
    email.smtp.passFile = config.sops.secrets."smtp-pass".path;
    push = {
      vapidPublicKeyFile = config.sops.secrets."vapid-public-key".path;
      vapidPrivateKeyFile = config.sops.secrets."vapid-private-key".path;
      firebaseServiceAccountKeyFile = config.sops.secrets."firebase-service-account.json".path;
    };
    extraSecretEnvironmentFiles = {
      IDURA_CLIENT_SECRET = config.sops.secrets."idura-client-secret".path;
    };
    extraEnvironment = {
      APP_URL = "http://localhost:18080";
      API_URL = "http://localhost:18080";
      IDURA_DOMAIN = "eulesia-test.criipto.id";
      IDURA_CLIENT_ID = "urn:my:application:identifier:923383";
      IDURA_CALLBACK_URL = "http://localhost:18080/api/v1/auth/ftn/callback";
    };
  };

  environment.systemPackages = with pkgs; [
    curl
    jq
    postgresql_16
  ];

  systemd.services.logrotate-checkconf.enable = false;

  system.stateVersion = "24.11";
}
