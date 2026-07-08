FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 1234

# Em dev o compose sobrescreve com "npm run dev" (tsx watch) + bind-mount.
CMD ["npm", "run", "start"]
