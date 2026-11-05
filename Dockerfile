FROM docker.arvancloud.ir/library/node:22-slim AS builder

WORKDIR /app

RUN npm config set registry https://package-mirror.liara.ir/repository/npm/

COPY package.json ./
RUN npm install

COPY . .

# Vite inlines these into the bundle, so they're build args, not runtime env.
ARG VITE_API_URL
ARG VITE_HLS_URL
ARG VITE_RTMP_URL
# Optional: defaults to VITE_HLS_URL with /live -> /abr.
ARG VITE_HLS_ABR_URL

RUN npm run build

FROM docker.arvancloud.ir/library/nginx:stable-alpine AS production

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.prod.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
