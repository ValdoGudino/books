# Stage 1: Build Stage
FROM node:24-alpine AS build-stage

WORKDIR /app

# Cache dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Production Stage
FROM nginx:stable-alpine AS production-stage

# Copy the built files from the build-stage
# Vite outputs to 'dist' by default
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copy a custom nginx config to handle Vue Router (History mode)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
