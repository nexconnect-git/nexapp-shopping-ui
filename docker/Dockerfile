FROM node:24

WORKDIR /app

COPY frontend/package*.json ./
COPY packages /packages
RUN npm install

COPY frontend/ .
COPY packages /packages
RUN npm run build:packages

EXPOSE 4200 4201 4202 4203
