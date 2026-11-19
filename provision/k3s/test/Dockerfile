FROM debian:trixie
RUN apt-get update -q && DEBIAN_FRONTEND=noninteractive apt-get install -yq --no-install-recommends systemd systemd-sysv dbus \
    && rm -rf /var/lib/apt/lists/* && useradd -m -u 1000 cupcake
COPY . /src
RUN /src/install-rootfs.sh / /src/build/k3s /src/build/images && /src/configure-chroot.sh \
    && rm -rf /src && : > /etc/machine-id
STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
