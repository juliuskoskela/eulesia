{
  config,
  eulesiaPackages,
  lib,
  ...
}: {
  imports = [
    ../modules/eulesia.nix
  ];

  networking.hostName = "eulesia-test";
  networking.useDHCP = lib.mkDefault true;

  boot.loader.grub.device = "/dev/sda";
  fileSystems."/" = {
    device = "/dev/disk/by-label/nixos";
    fsType = "ext4";
  };

  services.openssh.enable = true;

  sops = {
    age.keyFile = "/var/lib/sops-nix/key.txt";
    secrets = import ./lib/eulesia-secrets.nix {
      inherit config;
      secretDir = ../../secrets/test;
    };
  };

  services.eulesia = {
    enable = true;
    package = eulesiaPackages.api;
    frontendPackage = eulesiaPackages.frontend;
    appDomain = "test.eulesia.eu";
    apiDomain = "api.test.eulesia.eu";
    email = {
      provider = "smtp";
      from = "noreply@aihiolabs.com";
      smtp = {
        host = "mail.infomaniak.com";
        port = 587;
        secure = false;
      };
    };
    tls.acmeEmail = "admin@eulesia.eu";
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
      IDURA_DOMAIN = "eulesia-test.criipto.id";
      IDURA_CLIENT_ID = "urn:my:application:identifier:923383";
      IDURA_CALLBACK_URL = "https://api.test.eulesia.eu/api/v1/auth/ftn/callback";
    };
  };

  system.stateVersion = "24.11";
}
