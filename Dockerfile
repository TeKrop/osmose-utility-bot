FROM node:16-alpine

WORKDIR /code

COPY index.js deploy-commands.js package.json app.sh /code/
COPY ./commands /code/commands
COPY ./constants /code/constants
COPY ./services /code/services

RUN cd /code && npm install --omit=dev

CMD ["sh", "/code/app.sh"]