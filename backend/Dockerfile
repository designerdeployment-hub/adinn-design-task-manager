FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY src ./src
COPY data ./data
COPY uploads ./uploads
EXPOSE 5001
CMD ["npm", "start"]
