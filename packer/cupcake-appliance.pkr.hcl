variable "arch" {
  type    = string
  default = "amd64"
}

variable "image_type" {
  type    = string
  default = "vm"
}

variable "output_dir" {
  type    = string
  default = "output"
}

variable "backend_ref" {
  type    = string
  default = "master"
}

variable "webgui_ref" {
  type    = string
  default = "master"
}

variable "vanilla_ng_ref" {
  type    = string
  default = "master"
}

locals {
  is_vm  = var.image_type == "vm"
  is_rpi = var.image_type == "rpi"
  is_arm64_cross = var.arch == "arm64"

  disk_format = local.is_vm ? "qcow2" : "raw"
  disk_size   = local.is_vm ? "8192" : "4096"

  iso_url = "https://releases.ubuntu.com/24.04.2/ubuntu-24.04.2-live-server-${var.arch}.iso"
}

source "qemu" "cupcake" {
  iso_url           = local.iso_url
  iso_checksum      = "none"
  output_directory  = "${var.output_dir}/cupcake-${var.image_type}-${var.arch}"

  vm_name   = "cupcake-${var.image_type}-${var.arch}"
  disk_size = local.disk_size
  format    = local.disk_format

  accelerator = local.is_arm64_cross ? "none" : "kvm"
  headless    = true

  qemu_binary = local.is_arm64_cross ? "qemu-system-aarch64" : ""
  cpu_model   = local.is_arm64_cross ? "cortex-a72" : "host"

  http_directory = "packer/http"
  boot_wait      = "10s"

  ssh_username = "cupcake"
  ssh_password = "cupcake"

  boot_command = [
    "<esc><wait>",
    "linux /casper/vmlinuz autoinstall ds=nocloud-net;s=http://{{ .HTTPIP }}:{{ .HTTPPort }}/ ",
    "<enter>"
  ]

  shutdown_command = "echo 'cupcake' | sudo -S shutdown -P now"
}

build {
  sources = ["source.qemu.cupcake"]

  provisioner "shell" {
    environment_vars = [
      "BACKEND_REF=${var.backend_ref}",
      "WEBGUI_REF=${var.webgui_ref}",
      "VANILLA_NG_REF=${var.vanilla_ng_ref}",
    ]
    scripts = [
      "packer/scripts/01-base.sh",
      "packer/scripts/02-postgresql.sh",
      "packer/scripts/03-redis.sh",
      "packer/scripts/04-backend.sh",
      "packer/scripts/05-frontend.sh",
      "packer/scripts/06-nginx.sh",
      "packer/scripts/07-mdns.sh",
      "packer/scripts/08-cleanup.sh",
    ]
  }
}
