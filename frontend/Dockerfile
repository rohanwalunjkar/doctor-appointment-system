FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy application code
COPY . .

# Replace localhost proxy target with K8s backend service URL
RUN sed -i "s|http://localhost:8000|http://backend-service:8000|g" vite.config.js

EXPOSE 3000

CMD ["npx", "vite", "--host", "0.0.0.0"]
