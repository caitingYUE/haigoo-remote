FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . ./
ENV NODE_ENV=production
EXPOSE 8080
CMD ["npm", "start"]
