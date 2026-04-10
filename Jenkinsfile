pipeline {
  agent any

  triggers {
    githubPush()
  }

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
        sh 'npm ci --no-audit --no-fund'
        sh 'npm --prefix backend ci --ignore-scripts --omit=optional --no-audit --no-fund'
        sh 'npm --prefix frontend ci --no-audit --no-fund'
        sh 'npm --prefix services/logo-service ci --ignore-scripts --omit=optional --no-audit --no-fund'
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
        sh 'docker compose down --remove-orphans'
        sh 'docker compose up -d redis kafka mongodb backend worker logo-service kafka-service'
      }
    }

    stage('Post-Deploy Validation') {
      steps {
        sh 'npm run validate'
        sh 'npm run validate:logo-pipeline'
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
