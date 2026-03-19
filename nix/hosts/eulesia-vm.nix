{
  config,
  eulesiaPackages,
  modulesPath,
  pkgs,
  ...
}: {
  imports = [
    (modulesPath + "/virtualisation/qemu-vm.nix")
    ../modules/eulesia.nix
  ];

  networking.hostName = "eulesia-vm";
  networking.firewall.enable = true;

  sops = {
    age.keyFile = "/mnt/host-sops-age/keys.txt";
    secrets = import ./lib/eulesia-secrets.nix {
      inherit config;
      secretDir = ../../secrets/test;
    };
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
    meilisearch.masterKeyFile = config.sops.secrets."meili-master-key".path;
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
      APP_URL = "http://localhost:8080";
      API_URL = "http://localhost:8080";
      IDURA_DOMAIN = "eulesia-test.criipto.id";
      IDURA_CLIENT_ID = "urn:my:application:identifier:923383";
      IDURA_CALLBACK_URL = "http://localhost:8080/api/v1/auth/ftn/callback";
    };
  };

  virtualisation = {
    memorySize = 4096;
    cores = 2;
    sharedDirectories = {
      host-sops-age = {
        source = "$HOME/.config/sops/age";
        target = "/mnt/host-sops-age";
      };
    };
    forwardPorts = [
      {
        from = "host";
        host.port = 8080;
        guest.port = 80;
      }
      {
        from = "host";
        host.port = 3001;
        guest.port = 3001;
      }
    ];
  };

  environment.systemPackages = with pkgs; [curl];

  system.stateVersion = "24.11";
}
