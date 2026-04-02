{modulesPath, ...}: {
  imports = [
    (modulesPath + "/profiles/qemu-guest.nix")
  ];

  boot = {
    loader = {
      grub = {
        enable = true;
        device = "nodev";
        efiSupport = true;
        efiInstallAsRemovable = true;
        configurationLimit = 3;
      };
      efi.canTouchEfiVariables = false;
    };

    initrd.availableKernelModules = [
      "ata_piix"
      "uhci_hcd"
      "xen_blkfront"
      "vmw_pvscsi"
    ];
    initrd.kernelModules = ["nvme"];
  };
}
