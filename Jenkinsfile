pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    triggers {
        githubPush()
    }

    environment {
        COMPOSE_PROJECT_NAME = 'sisa-front'
        COMPOSE_FILE        = 'docker-compose.yml'
        ENV_FILE_CDS        = credentials('sisa-front-env-cds')

        JENKINS_URL     = 'https://testdti.utez.edu.mx:8443'
        PROJECT_NAME    = '118-SISA-FRONT'
        GIT_REPO        = 'https://github.com/cdsutezoficial/118-SISA-FRONT.git'
        GIT_CREDENTIALS = 'CDSUTEZ'
        GIT_BRANCH      = 'test'
    }

    stages {
        stage('Checkout') {
            steps {
                deleteDir()
                git branch: env.GIT_BRANCH, credentialsId: env.GIT_CREDENTIALS, url: env.GIT_REPO
            }
        }

        stage('Validar configuración') {
            steps {
                echo 'Validando docker-compose con el archivo de entorno...'
                sh 'docker compose --env-file $ENV_FILE_CDS -f docker-compose.yml config -q'
            }
        }

        stage('Detener servicios') {
            steps {
                echo 'Deteniendo servicios existentes...'
                sh 'docker compose --env-file $ENV_FILE_CDS -f docker-compose.yml down --remove-orphans || true'
                sh '''
                    # 1) Eliminar contenedores del proyecto por nombre (cualquier estado)
                    for CONTAINER in ui-sisa; do
                        if docker ps -a --format "{{.Names}}" | grep -q "^${CONTAINER}$"; then
                            echo "Eliminando contenedor $CONTAINER"
                            docker rm -f "$CONTAINER" || true
                        fi
                    done

                    # 2) Eliminar contenedores que ocupen los puertos (cualquier estado)
                    FRONT_PORT=$(grep -E '^FRONT_PORT=' "$ENV_FILE_CDS" | tail -n1 | cut -d= -f2- | tr -d '\\r" ')
                    for PORT in $FRONT_PORT; do
                        CONTAINER=$(docker ps -a --format "{{.ID}} {{.Ports}}" | grep ":${PORT}->" | awk '{print $1}')
                        if [ -n "$CONTAINER" ]; then
                            echo "Puerto $PORT ocupado por contenedor $CONTAINER — eliminando"
                            docker rm -f $CONTAINER || true
                        fi
                    done
                '''
            }
        }

        stage('Limpiar recursos Docker') {
            steps {
                echo 'Limpiando imágenes antiguas del proyecto SISA-FRONT...'
                sh '''
                    # Eliminar solo las imágenes antiguas de este proyecto
                    docker images | grep sisa-ui | grep -v latest | awk '{print $3}' | xargs -r docker rmi -f || true

                    # Limpiar solo imágenes dangling (sin etiqueta)
                    docker image prune -f
                '''
            }
        }

        stage('Construir imágenes') {
            steps {
                echo 'Construyendo imágenes sin caché...'
                sh 'docker compose --env-file $ENV_FILE_CDS -f docker-compose.yml build --no-cache'
            }
        }

        stage('Levantar servicios') {
            steps {
                echo 'Levantando servicios...'
                sh 'docker compose --env-file $ENV_FILE_CDS -f docker-compose.yml up -d'
            }
        }

        stage('Verificar servicios') {
            steps {
                echo 'Verificando estado de los servicios...'
                sh 'docker compose --env-file $ENV_FILE_CDS -f docker-compose.yml ps'
                sh 'docker compose --env-file $ENV_FILE_CDS -f docker-compose.yml logs --tail=20'
            }
        }

        stage('Healthcheck') {
            steps {
                echo 'Verificando salud de los servicios...'
                sh '''
                    sleep 10
                    docker inspect --format='{{.State.Health.Status}}' ui-sisa || echo "Sin healthcheck"
                    docker inspect --format='{{.State.Status}}' ui-sisa
                '''
            }
        }
    }

    post {
        success {
            echo 'OK'
        }

        failure {
            echo 'NO'
        }
    }
}
