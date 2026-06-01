https://www.itforbusiness.fr/avec-lia-agentique-lentreprise-passe-a-lhumain-delegue-103650

# API REST Spring Boot — Plateforme d’Annotation d’Images
# Nom de code du projet : TAGTIC

# 1. Objectif

Mettre en place une API REST publique avec Spring Boot (sans Spring Security) permettant de :

* gérer des projets d’annotation ;
* configurer des formulaires d’annotation dynamiques ;
* associer des images à un projet ;
* annoter les images d’un projet selon un formulaire ;
* préremplir automatiquement certains champs à partir des métadonnées JSON des images ;
* tracer chaque valeur d’annotation par champ du formulaire.

---

# 2. Stack Technique

## Backend

* Java 21
* Spring Boot 3.x
* Spring Web
* Spring Data JPA
* Hibernate
* H2
* Bean Validation (`jakarta.validation`)
* Lombok
* OpenAPI / Swagger

---

# 3. Stockage des Images

Les images sont stockées sur un serveur S3 compatible :

* AWS S3

L’API ne stocke que :

* l’URL S3 ;
* les métadonnées JSON.

---

# 4. Architecture Métier

```text
Projet d’annotation
    ├── Formulaire d’annotation
    │       └── Champs du formulaire
    │
    ├── Images
    │       └── Métadonnées JSON
    │
    └── Annotations
            └── Valeurs d’annotation par champ
```

---

# 5. Modèle de Données

# 5.1 AnnotationProject

Projet principal d’annotation.

## Champs

| Champ       | Type    | Description                             |
| ----------- | ------- | --------------------------------------- |
| id          | UUID    | Identifiant                             |
| title       | String  | Titre                                   |
| description | Text    | Description                             |
| status      | ENUM    | DRAFT / READY / IN_PROGRESS / COMPLETED |
| createdBy   | String  | Créateur                                |
| createdAt   | Instant | Date création                           |
| updatedAt   | Instant | Date modification                       |
| formId      | UUID    | Formulaire associé                      |

---

# 5.2 AnnotationForm

Définition du formulaire d’annotation.

## Champs

| Champ       | Type    |
| ----------- | ------- |
| id          | UUID    |
| title       | String  |
| description | String  |
| version     | Integer |
| createdBy   | String  |
| createdAt   | Instant |

---

# 5.3 FormField

Définition dynamique d’un champ du formulaire.

## Champs

| Champ           | Type    | Description                               |
| --------------- | ------- | ----------------------------------------- |
| id              | UUID    |                                           |
| formId          | UUID    |                                           |
| name            | String  | clé technique                             |
| label           | String  | libellé affiché                           |
| type            | ENUM    | TEXT / NUMBER / BOOLEAN / DATE / SELECT   |
| required        | Boolean |                                           |
| orderIndex      | Integer | ordre affichage                           |
| defaultValue    | String  |                                           |
| jsonMappingKey  | String  | clé metadata utilisée pour préremplissage |
| validationRules | JSONB   | règles dynamiques                         |

---

# 5.4 ProjectImage

Image appartenant à un projet.

## Champs

| Champ     | Type    |
| --------- | ------- |
| id        | UUID    |
| projectId | UUID    |
| s3Url     | String  |
| metadata  | JSONB   |
| createdAt | Instant |

## Exemple metadata

```json 
{
  "classification": "CHEQUE",
  "extractions": 
  {
    "amount":12.5,
    "account":"001745778710005210035"
  }
}
```

---

# 5.5 Annotation

Annotation globale d’une image.

## Champs

| Champ       | Type    | Description                    |
| ----------- | ------- | ------------------------------ |
| id          | UUID    |                                |
| projectId   | UUID    | projet concerné                |
| imageId     | UUID    | image annotée                  |
| annotatedBy | String  | utilisateur                    |
| annotatedAt | Instant | date annotation                |
| status      | ENUM    | PENDING / VALIDATED / REJECTED |

---

# 5.6 AnnotationFieldValue

Valeur d’annotation associée à un champ du formulaire.

## Champs

| Champ             | Type    | Description               |
| ----------------- | ------- | ------------------------- |
| id                | UUID    |                           |
| annotationId      | UUID    | annotation parent         |
| formFieldId       | UUID    | champ du formulaire       |
| fieldName         | String  | snapshot du nom technique |
| fieldLabel        | String  | snapshot du label         |
| fieldType         | ENUM    | snapshot du type          |
| value             | JSONB   | valeur saisie             |
| autoFilled        | Boolean | valeur issue du metadata  |
| sourceMetadataKey | String  | clé metadata utilisée     |
| createdAt         | Instant | date création             |

---

# 6. Relations

```text
AnnotationProject 1---1 AnnotationForm

AnnotationForm 1---N FormField

AnnotationProject 1---N ProjectImage

AnnotationProject 1---N Annotation

Annotation 1---N AnnotationFieldValue

AnnotationFieldValue N---1 FormField
```

---

# 7. Workflow Métier

# Étape 1 — Création du projet

```http
POST /api/projects
```

Payload :

```json
{
  "title": "Projet IRM cerveau",
  "description": "Annotation lésions"
}
```

---

# Étape 2 — Création du formulaire (associé à un projet)

```http
POST /api/forms
```

---

# Étape 3 — Ajout des champs

```http
POST /api/forms/{formId}/fields
```

Exemple :

```json
[
  {
    "name": "account",
    "label": "N° de compte",
    "type": "TEXT",
    "required": true,
    "jsonMappingKey": "account"
  },
  {
    "name": "amount",
    "label": "Montant du chèque",
    "type": "NUMBER",
    "jsonMappingKey": "amount"
  }
]
```

---

# Étape 4 — Association formulaire ↔ projet

```http
PUT /api/projects/{projectId}/form/{formId}
```

---

# Étape 5 — Ajout des images au projet

```http
POST /api/projects/{projectId}/images
```

Payload :

```json
{
  "s3Url": "https://bucket.s3.amazonaws.com/img1.png",
  "metadata": {
    "classification": "CHEQUE",
    "extractions": 
    {
      "amount":12.5,
      "account":"001745778710005210035"
    }
  }
}
```

---

# Étape 6 — Annotation des images

L’utilisateur :

1. charge une image du projet ;
2. récupère le formulaire du projet ;
3. obtient un préremplissage automatique ;
4. complète les champs ;
5. sauvegarde l’annotation.

---

# 8. Préremplissage Automatique

Chaque champ du formulaire peut être lié à une clé des métadonnées JSON.

## Exemple

Champ :

```text
name = amount
jsonMappingKey = amount
```

Metadata image :

```json
{
  "amount": 12.5
}
```

Préremplissage automatique :

```json
{
  "amount": 12
}
```

---

# 9. Exemple d’Annotation

# Formulaire

```json 
[
  {
    "id": "field-1",
    "name": "amount",
    "label": "Montant",
    "type": "NUMBER",
    "jsonMappingKey": "amount"
  }
]
```

---

# Metadata image

```json 
{
  "amount": 12
}
```

---

# Annotation créée

## Annotation

```json
{
  "id": "annotation-1",
  "projectId": "project-1",
  "imageId": "image-1",
  "annotatedBy": "user1",
  "status": "PENDING"
}
```

---

## AnnotationFieldValues

```json
[
  {
    "formFieldId": "field-1",
    "fieldName": "amount",
    "fieldType": "NUMBER",
    "value": 54,
    "autoFilled": true,
    "sourceMetadataKey": "age"
  },
  {
    "formFieldId": "field-2",
    "fieldName": "account",
    "fieldType": "TEXT",
    "value": "00155878410001540047021",
    "autoFilled": false
  }
]
```

---

# 10. API REST

# 10.1 Projects API

## Créer un projet

```http
POST /api/projects
```

## Lister les projets

```http
GET /api/projects
```

## Détail d’un projet

```http
GET /api/projects/{id}
```

## Modifier un projet

```http
PUT /api/projects/{id}
```

## Supprimer un projet

```http
DELETE /api/projects/{id}
```

---

# 10.2 Forms API

## Créer un formulaire

```http
POST /api/forms
```

## Ajouter un champ

```http
POST /api/forms/{formId}/fields
```

## Lister les champs

```http
GET /api/forms/{formId}/fields
```

---

# 10.3 Association Projet/Formulaire

## Associer un formulaire à un projet

```http
PUT /api/projects/{projectId}/form/{formId}
```

---

# 10.4 Images API

## Ajouter une image au projet

```http
POST /api/projects/{projectId}/images
```

## Lister les images d’un projet

```http
GET /api/projects/{projectId}/images
```

## Détail d’une image

```http
GET /api/images/{imageId}
```

---

# 10.5 Annotation API

## Charger le formulaire prérempli d’une image

```http
GET /api/projects/{projectId}/images/{imageId}/annotation-form
```

## Exemple réponse

```json id="98d0i7"
{
  "imageId": "image-1",
  "fields": [
    {
      "formFieldId": "field-1",
      "name": "patient_age",
      "type": "NUMBER",
      "value": 54,
      "autoFilled": true
    },
    {
      "formFieldId": "field-2",
      "name": "diagnosis",
      "type": "TEXT",
      "value": null,
      "autoFilled": false
    }
  ]
}
```

---

## Sauvegarder une annotation

```http
POST /api/projects/{projectId}/annotations
```

Payload :

```json id="xjlwmz"
{
  "imageId": "image-1",
  "annotatedBy": "user1",
  "fields": [
    {
      "formFieldId": "field-1",
      "value": 54
    },
    {
      "formFieldId": "field-2",
      "value": "PNEUMONIA"
    }
  ]
}
```

---

## Lister les annotations d’un projet

```http 
GET /api/projects/{projectId}/annotations
```

---

## Récupérer les annotations d’une image

```http 
GET /api/projects/{projectId}/images/{imageId}/annotations
```

---

# 11. Réponse API Standardisée

# Success

```json 
{
  "success": true,
  "data": {}
}
```

---

# Error

```json
{
  "success": false,
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project not found"
  }
}
```

---

# 12. Structure Projet Spring Boot

```text id="0dqq4q"
src/main/java
    ├── controller
    ├── service
    ├── repository
    ├── entity
    ├── dto
    ├── mapper
    ├── exception
    ├── validation
    └── config
```

---

# 13. Gestion H2 JSON

Utiliser H2 JSON pour :

* metadata
* validationRules
* value

---

# Exemple Hibernate

```java
private Object value;
```

---

# 14. États Métier

# Projet

```text 
DRAFT
READY
IN_PROGRESS
COMPLETED
ARCHIVED
```

---

# Annotation

```text 
PENDING
VALIDATED
REJECTED
```

---

# 15. Swagger / OpenAPI


---

# 16. DTO

# Requests (exemples)

```text 
CreateProjectRequest
CreateFormRequest
AddFieldRequest
CreateAnnotationRequest
```

---

# Responses

```text
ProjectResponse
FormResponse
AnnotationResponse
```

---

# 17. Recommandations Importantes

# Versionner les formulaires

Ajouter un champ :

```text 
version
```

sur `AnnotationForm`.

---

# Snapshotter les champs dans AnnotationFieldValue

Conserver :

* fieldName
* fieldLabel
* fieldType

afin de garantir la cohérence historique.

---

# Pagination

Prévoir :

```http
GET /api/projects/{id}/images?page=0&size=20
```

---

# Recherche JSONB

Prévoir des filtres JSON :

```sql 
metadata->>'country' = 'FR'
```