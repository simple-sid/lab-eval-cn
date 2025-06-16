# 🔐 Step 1: Generate SSH Key Pair

On your host (not inside the container):

    ssh-keygen -t rsa -b 2048 -f ./labuser_key -N ""

    •	labuser_key – private key
    •	labuser_key.pub – public key

You’ll use labuser_key to connect from your backend, and labuser_key.pub will go inside the container.

# 🐳 Step 2: Build docker image

    Use provided dockerfile in DockerFile.md
        docker build -t lab-cn-image .

    Place labuser_key.pub in the same directory as this Dockerfile before building.

# 🔧 Step 3: Backend SSH Connection (Node.js with ssh2)

    Ensure your backend uses:

    const { Client } = require('ssh2');

    const conn = new Client();
    conn.connect({
    host: '127.0.0.1',
    port: 2201,
    username: 'labuser',
    privateKey: fs.readFileSync('./labuser_key')
    });

    >> and make sure './labuser_key' is provided in the path 'lab-eval-cn/server/labuser_key' and
    Make sure labuser_key is accessible and secure (use .gitignore!).
    and run :

    chmod 600 labuser_key

    So that , 	•	6 (read + write) for the owner of the file.
                •	0 (no permissions) for group and others.
