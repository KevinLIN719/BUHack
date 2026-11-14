# Policy Lens — single-port container image (v3 shell + Agent backend)
FROM node:24-slim

WORKDIR /app

# `npm run start:v3` runs the TypeScript server through tsx, which lives in
# devDependencies, so development dependencies must be installed even though
# the container runs a production build. NODE_ENV is set after the install so
# `npm ci` does not silently omit them.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .

ENV NODE_ENV=production \
    POLICY_LENS_HOST=0.0.0.0

# Cloud platforms inject PORT; the app falls back to 4185 locally.
EXPOSE 4185
CMD ["npm", "run", "start:v3"]
