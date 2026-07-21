FROM node:20-slim

WORKDIR /app

COPY package*.json ./
COPY .npmrc ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
