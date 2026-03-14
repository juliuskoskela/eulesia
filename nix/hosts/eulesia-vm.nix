{
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

  services.eulesia = {
    enable = true;
    package = eulesiaPackages.api;
    frontendPackage = eulesiaPackages.frontend;
    appDomain = "localhost";
    apiDomain = "api.localhost";
    tls.enable = false;
    tls.acmeEmail = null;
    meilisearch.masterKeyFile = pkgs.writeText "meili-master-key" "vm-meili-master-key";
    auth.sessionSecretFile = pkgs.writeText "session-secret" "vm-session-secret-with-at-least-32-bytes";
  };

  virtualisation = {
    memorySize = 4096;
    cores = 2;
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
