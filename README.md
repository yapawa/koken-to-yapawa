# Koken to Yapawa

[Lambda](https://aws.amazon.com/lambda/) scripts orchestrated with [Step Function](https://aws.amazon.com/step-functions/) to import [Koken](http://koken.me) data into [Yapawa](https://github.com/yapawa/)

## Usage

Prerequisites:
- An AWS account
- AWS CLI
- An AWS profile setup with sufficient permissions
- [Serverless.com](https://serverless.com/cli/) cli
- nvm
- nodejs
- A Koken site and access to the KOKEN_ENCRYPTION_KEY
- A deployed [Yapawa Albums Manager](https://github.com/yapawa/albumsManager)

```
git clone https://github.com/yapawa/koken-to-yapawa
cd koken-to-yapawa
nvm use
npm ci
```
### Configure stage
```
cp -a stages/sample.yml stages/production.yml
```
Edit _production.yml_ to suit your needs

### Create base event
```bash
cat <<EOF > events/site.json
{
  "domain": "kokenDomain",
  "albumTable": "DynamodB Album table Name",
  "photoTable": "DynamodB Photo table Name",
  "encryptionKey": "Koken encryption key",
  "bucket": "Yapawa S3 bucket name storing originals",
  "region": "AWS region"
}
EOF
```

#### Koken encryption key
It can be retrieved from:
```bash
cat storage/configuration/key.php
```

## Deploy it
```bash
npx sls deploy
```

## Run it
- *From sls*:
  ```bash
  sls invoke stepf --name KokenToYapawa -p events/site.json
  ```
- *From the [AWS console](console.aws.amazon.com/states/)*:
  Copy the content of _site.json_ as the executions input
- *From AWS CLI*:
  ```bash
  profile=myProfile
  input=$(<events/site.json)
  arn=$(aws --profile yapawa stepfunctions list-state-machines \
    --output text \
    --query 'stateMachines[?name==`KokenToYapawa`].stateMachineArn')
  aws --profile $profile stepfunctions start-execution \
    --state-machine-arn $arn\
    --input "$input"
  ```

Grab a coffee and wait...

## Clean up
Once the migration is done, this stack can be safely removed.

```bash
npx sls remove
```
