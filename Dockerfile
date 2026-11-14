# Policy Lens — single-port container image (v3 shell + Agent backend)
FROM node:24-slim

WORKDIR /app
ENV NODE_ENV=production \
    POLICY_LENS_HOST=0.0.0.0

# Dependencies first so the layer is cached across app edits.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Cloud platforms inject PORT; the app falls back to 4185 locally.
EXPOSE 4185
CMD ["npm", "run", "start:v3"]
