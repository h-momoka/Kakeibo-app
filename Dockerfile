FROM node:20-alpine

WORKDIR  /app/

RUN apk add --no-cache openssl

COPY . .

WORKDIR /app/server
RUN  npm install

RUN npx prisma generate

EXPOSE  3000

CMD ["node", "src/index.js"]