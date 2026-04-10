pipeline {
  agent any
  options {
    timestamps()
    disableConcurrentBuilds()
    timeout(time: 120, unit: 'MINUTES')
  }

  environment {
    NODE_ENV = 'production'
    NODE_OPTIONS = '--max-old-space-size=4096'
    COMPOSE_PROJECT_NAME = 'tradereplay'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install Dependencies') {
      steps {
        sh 'npm ci --include=dev --no-audit --no-fund'
        sh 'npm --prefix backend ci --include=dev --ignore-scripts --no-audit --no-fund'
        sh 'npm --prefix frontend ci --include=dev --ignore-scripts --no-audit --no-fund'
        sh 'npm --prefix services/logo-service ci --include=dev --ignore-scripts --no-audit --no-fund'
      }
    }

    stage('Build') {
      steps {
        sh 'npm --prefix backend run build'
        sh 'npm --prefix frontend run build'
        sh 'npm --prefix services/logo-service run build'
      }
    }

    stage('Docker Build') {
      steps {
        sh 'docker compose build'
      }
    }

    stage('Deploy') {
      steps {
        sh 'cp deploy/env/.env.ci .env'
        sh 'cp deploy/env/.env.secrets.ci .env.secrets'
        sh 'docker compose down --remove-orphans'
        sh 'docker compose up -d redis kafka mongodb backend worker logo-service kafka-service'
      }
    }

    stage('Post-Deploy Validation') {
      steps {
        sh '''
          echo "Waiting for backend to be healthy..."
          i=1
          max_retries=90
          while true; do
            health=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' tradereplay-backend 2>/dev/null || echo missing)
            if [ "$health" = "healthy" ]; then
              break
            fi
            if [ "$i" -ge "$max_retries" ]; then
              echo "Backend failed to become healthy after $max_retries attempts (last status: $health)"
              docker compose ps || true
              docker compose logs --tail=120 backend || true
              exit 1
            fi
            echo "Retry $i/$max_retries... backend status=$health"
            i=$((i + 1))
            sleep 2
          done
          echo "Backend is ready"
        '''
        sh 'BACKEND_URL=http://host.docker.internal:4000 REDIS_URL_DOCKER=redis://host.docker.internal:6379 KAFKA_BROKER_DOCKER=host.docker.internal:19092 npm run validate'
        sh 'BACKEND_URL=http://host.docker.internal:4000 REDIS_URL_DOCKER=redis://host.docker.internal:6379 KAFKA_BROKER_DOCKER=host.docker.internal:19092 npm run validate:logo-pipeline'
      }
    }
  }

  post {
    always {
      sh 'docker compose ps || true'
    }
    failure {
      sh 'docker compose logs --tail=200 backend worker logo-service kafka-service redis kafka || true'
    }
  }
}








