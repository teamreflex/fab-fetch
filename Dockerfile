FROM node:18.13.0

ENV WORK_DIR=/app
RUN mkdir -p ${WORK_DIR}
WORKDIR ${WORK_DIR}

RUN mkdir ${WORK_DIR}/data
RUN chmod -R 777 ${WORK_DIR}/data

COPY package.json ./package.json
COPY package-lock.json ./package-lock.json

RUN npm ci

COPY . .