# Base image
FROM ubuntu:22.04

# Avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

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
    vim \
    curl \
    bash \
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

# Expose SSH port
EXPOSE 22

# Set shell to bash
RUN echo "labuser ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers && \
    chsh -s /bin/bash labuser

# Start SSH daemon
CMD ["/usr/sbin/sshd", "-D"]