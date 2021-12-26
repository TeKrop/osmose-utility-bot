FROM debian:bullseye

MAINTAINER TeKrop <contact@tekrop.fr>

ENV DEBIAN_FRONTEND noninteractive

RUN apt update \
    && apt install -y --no-install-recommends apt-transport-https apt-utils ca-certificates curl \
    && curl -fsSL https://deb.nodesource.com/setup_16.x | bash - \
    && apt install -y --no-install-recommends nodejs build-essential git

RUN cd /opt/ \
    && git clone https://github.com/TeKrop/osmose-utility-bot.git \
    && cd osmose-utility-bot \
    && npm install \
    && rm -rf /var/lib/{apt,dpkg,cache,log}/ /tmp/* /var/tmp/*

RUN npm install -g nodemon

WORKDIR /opt/osmose-utility-bot

CMD ["bash", "app.sh"]