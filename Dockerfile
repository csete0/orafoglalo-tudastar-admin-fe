FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

FROM nginx:1.27-alpine
# Önaláírt tanúsítvány: az admin csak belső hálózatról érhető el, publikus domain nélkül.
RUN apk add --no-cache openssl \
    && openssl req -x509 -nodes -newkey rsa:2048 -days 3650 -subj "/CN=patricks-admin" \
       -keyout /etc/nginx/admin.key -out /etc/nginx/admin.crt \
    && apk del openssl
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist/admin-fe/browser /usr/share/nginx/html
EXPOSE 443
