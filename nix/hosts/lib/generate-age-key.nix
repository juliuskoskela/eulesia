{pkgs, ...}: {
  systemd.services.generate-age-key = {
    description = "Generate age key for sops-nix";
    wantedBy = ["multi-user.target"];
    after = ["local-fs.target"];

    serviceConfig = {
      Type = "oneshot";
      RemainAfterExit = true;
    };

    script = ''
      mkdir -p /var/lib/sops-nix
      chmod 700 /var/lib/sops-nix

      if [ ! -f /var/lib/sops-nix/key.txt ]; then
        echo "Generating new age key..."
        ${pkgs.age}/bin/age-keygen -o /var/lib/sops-nix/key.txt
        chmod 600 /var/lib/sops-nix/key.txt

        echo "Age public key generated:"
        ${pkgs.age}/bin/age-keygen -y /var/lib/sops-nix/key.txt
      else
        echo "Age key already exists"
      fi
    '';
  };
}
