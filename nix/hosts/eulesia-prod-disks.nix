{
  disko.devices = {
    disk = {
      system = {
        device = "/dev/disk/by-id/scsi-0QEMU_QEMU_HARDDISK_114785278";
        type = "disk";
        content = {
          type = "gpt";
          partitions = {
            boot = {
              size = "1M";
              type = "EF02";
            };
            ESP = {
              size = "500M";
              type = "EF00";
              content = {
                type = "filesystem";
                format = "vfat";
                mountpoint = "/boot";
              };
            };
            root = {
              size = "100%";
              content = {
                type = "filesystem";
                format = "ext4";
                mountpoint = "/";
              };
            };
          };
        };
      };

      postgres = {
        device = "/dev/disk/by-id/scsi-0HC_Volume_105268989";
        type = "disk";
        content = {
          type = "gpt";
          partitions = {
            data = {
              size = "100%";
              content = {
                type = "filesystem";
                format = "ext4";
                mountpoint = "/var/lib/postgresql";
              };
            };
          };
        };
      };
    };
  };
}
