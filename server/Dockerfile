# Base image
FROM ubuntu:22.04

# Avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Set proper terminal environment for interactive programs
ENV TERM=xterm-256color
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

# Install tools
RUN apt-get update && apt-get install -y \
    openssh-server \
    gcc \
    g++ \
    make \
    python3 \
    python3-pip \
    iputils-ping \
    net-tools \
    tcpdump \
    netcat \
    traceroute \
    nmap \
    iproute2 \
    telnet \
    vim \
    nano \
    curl \
    bash \
    psmisc \
    lsof \
    procps \
    && apt-get clean

# Create SSH directory and user
RUN mkdir /var/run/sshd && \
    useradd -m -s /bin/bash labuser

# Setup SSH keys for labuser
RUN mkdir -p /home/labuser/.ssh && \
    chmod 700 /home/labuser/.ssh

# Copy the public key from the build context (you must mount or ADD it during docker build)
COPY labuser_key.pub /home/labuser/.ssh/authorized_keys

# Set correct permissions
RUN chown -R labuser:labuser /home/labuser/.ssh && \
    chmod 600 /home/labuser/.ssh/authorized_keys

# Disable password auth and root login
RUN sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config && \
    sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config && \
    sed -i 's/#PermitEmptyPasswords no/PermitEmptyPasswords no/' /etc/ssh/sshd_config && \
    sed -i 's/PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config && \
    echo "AllowUsers labuser" >> /etc/ssh/sshd_config

# Add SSH server configurations for proper PTY allocation and interactive support
RUN echo "UsePAM yes" >> /etc/ssh/sshd_config && \
    echo "AcceptEnv LANG LC_*" >> /etc/ssh/sshd_config && \
    echo "TCPKeepAlive yes" >> /etc/ssh/sshd_config && \
    echo "PermitTTY yes" >> /etc/ssh/sshd_config

# Expose SSH port
EXPOSE 22

# Labuser can run commands with sudo without password, Set shell to bash
RUN echo "labuser ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers && \
    chsh -s /bin/bash labuser

# Set working directory to labuser home for proper execution environment
WORKDIR /home/labuser
USER labuser

# Ensure proper shell initialization for interactive programs
RUN echo 'export TERM=xterm-256color' >> ~/.bashrc && \
    echo 'export LANG=C.UTF-8' >> ~/.bashrc && \
    echo 'export LC_ALL=C.UTF-8' >> ~/.bashrc

# Switch back to root for SSH daemon startup
USER root

# Start SSH daemon
CMD ["/usr/sbin/sshd", "-D"]