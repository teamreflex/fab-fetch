FROM node:18.12.0

ENV WORK_DIR=/app
RUN mkdir -p ${WORK_DIR}
WORKDIR ${WORK_DIR}

COPY package.json ./package.json
COPY package-lock.json ./package-lock.json

RUN npm ci

COPY . .