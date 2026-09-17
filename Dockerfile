FROM node:20-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends python3.11 python3.11-venv python3-pip jq && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN pip install --no-cache-dir contree_sdk --break-system-packages
RUN npm run build:ui

EXPOSE 8080

CMD ["sh", "docker/start.sh"]
