FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG APP_VERSION=dev
ARG GIT_COMMIT=unknown
ENV VITE_APP_VERSION=$APP_VERSION
ENV VITE_GIT_COMMIT=$GIT_COMMIT
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
