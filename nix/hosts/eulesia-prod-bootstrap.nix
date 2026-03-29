{pkgs, ...}: {
  imports = [
    ./lib/hetzner-cloud-hardware.nix
    ./eulesia-prod-disks.nix
    ./lib/generate-age-key.nix
  ];

  networking = {
    hostName = "eulesia-prod";
    useDHCP = true;
    defaultGateway6 = {
      address = "fe80::1";
      interface = "enp1s0";
    };
    interfaces.enp1s0.ipv6 = {
      addresses = [
        {
          address = "2a01:4f9:c012:160d::1";
          prefixLength = 64;
        }
      ];
      routes = [
        {
          address = "fe80::1";
          prefixLength = 128;
        }
      ];
    };
    firewall = {
      enable = true;
      allowedTCPPorts = [22];
    };
  };

  zramSwap = {
    enable = true;
    memoryPercent = 50;
  };

  services.openssh = {
    enable = true;
    settings = {
      KbdInteractiveAuthentication = false;
      PasswordAuthentication = false;
      PermitRootLogin = "prohibit-password";
    };
  };

  users.users.root.openssh.authorizedKeys.keys = [
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPy3xxwKnAgznj0mSvCBriRYky98laGZE+DNHN5zaBSz julius.koskela@digimuoto.com"
  ];

  environment.systemPackages = with pkgs; [
    age
    curl
    vim
  ];

  system.stateVersion = "24.11";
}
