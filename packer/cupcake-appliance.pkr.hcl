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

  qemu_binary = var.arch == "arm64" ? "qemu-aarch64" : "qemu-x86_64"
  cpu_model   = var.arch == "arm64" ? "cortex-a72" : "host"

  # VM: qcow2, RPi: raw SD card image
  disk_format   = local.is_vm ? "qcow2" : "raw"
  disk_size     = local.is_vm ? "8192" : "4096"
  machine_type  = local.is_rpi ? "raspi3b" : "pc"
  firmware      = local.is_rpi ? "/usr/share/AAVMF/AAVMF_CODE.fd" : null

  iso_urls = local.is_rpi ? [
    "https://cdimage.ubuntu.com/ubuntu-server/24.04/release/ubuntu-24.04.2-live-server-arm64.iso",
  ] : [
    "https://releases.ubuntu.com/24.04.2/ubuntu-24.04.2-live-server-${var.arch}.iso",
  ]
  iso_checksum = local.is_rpi ? "file:https://cdimage.ubuntu.com/ubuntu-server/24.04/release/SHA256SUMS" : "file:https://releases.ubuntu.com/24.04.2/SHA256SUMS"
}

source "qemu" "cupcake" {
  iso_url          = local.iso_urls[0]
  iso_checksum     = local.iso_checksum
  output_directory = "${var.output_dir}/cupcake-${var.image_type}-${var.arch}"

  vm_name     = "cupcake-${var.image_type}-${var.arch}"
  disk_size   = local.disk_size
  format      = local.disk_format
  accelerator = "kvm"

  qemu_binary = local.qemu_binary
  cpu_model   = local.cpu_model

  http_directory = "http"
  boot_wait      = "5s"

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
      "scripts/01-base.sh",
      "scripts/02-postgresql.sh",
      "scripts/03-redis.sh",
      "scripts/04-backend.sh",
      "scripts/05-frontend.sh",
      "scripts/06-nginx.sh",
      "scripts/07-mdns.sh",
      "scripts/08-cleanup.sh",
    ]
  }

  post-processor "shell-local" {
    inline = [
      "echo Build complete: ${var.output_dir}/cupcake-${var.image_type}-${var.arch}",
    ]
  }
}
