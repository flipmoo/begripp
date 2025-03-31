General info Gripp API V3
Index
This apidocs provides information about the Gripp API. General information such as the operation of the API can be found on this page, and information about entities within Gripp (such as invoices) can be found in the menu on the left.

General
The API connector
Rights within the API
Types within the API
Custom fields
Filters within the API
Working with ID's
Options (such as paging and ordering)
Rate limits
Deep linking within Gripp
Extended properties
Webhooks
General
The Gripp API-token should be specified in the HTTP headers as follows:
Authorization: Bearer {YOURAPITOKEN}

Example: Authorization: Bearer Bacg7E5bNyqy9TGiSoB1b4IlUIaKhz
Gripp uses a JSON-RPC structure for processing API calls. A JSON-RPC request is an array of objects, with each object having the following fields:
method - a method name, for instance "invoice.create".
params - an array of parameters.
id - a sequence number that can be used for mapping a response to a request.

Note: the 'id'-parameter is NOT used for any identification of entities / records in the Gripp database. Its only purpose is the mapping of requests to responses. See json-rpc.org for more information.
PhP API connector
For your convenience, a basic API-connector is available to be included in your projects. It can be downloaded here. After including the file, an instance of the com_gripp_API class can be created. The API-connector translates calls to an appropriate JSON-RPC request. The method to call on the connector is created by concatenating the entity name, an underscore, and the remote method name. For instance, to call the 'create' method on the 'invoice' class, you can simply use $API->invoice_create($fields).

The Gripp API has two modes: single and batched. Using the batched mode, multiple requests can be joined together and executed in one transaction, offering a huge speed benefit, while fully maintaining database integrity.

Example 1: single mode
<?php
require_once('api.class.php');
$token = '#APITOKEN#'; //Your API token
$API = new ".$apiconnectorclassname."($token);

$fields = array(
    'name' => "My Tag"
);
$response = $API->tag_create($fields);

print '<pre>';
print_r($response);
?>
Example 2: batched mode
<?php
require_once('api.class.php');
$token = '#APITOKEN#'; //Your API token
$API = new ".$apiconnectorclassname."($token);

//batch processing, 1 request to server, 1 serverthread, fast!
$API->setBatchmode(true);
for($i = 0; $i < 10; $i++){
    $fields = array(
        'name' => "My Tag ".$i
    );
    $API->tag_create($fields);
}
$responses = $API->run();
print '<pre>';
print_r($responses);
?>
Rights
Every API-key is linked to an API-role (within you Gripp environment). Every API-role can be configured to allow specific CRUD rights on all the entities.
Note: because of this, not all examples on this page may work. In case of an 'Insufficient rights' warning, please adjust your API-role settings within Gripp.
Types
The Gripp API uses all the available types that JSON itself supports, eg: number, string, boolean, object, array and null. There is a difference between the string "1" and the number 1. Please make sure all your parameters are typed correctly. For enums, both an integer and string value can be used. For dates, the proper notation is in the standard MySql database notation: 'Y-m-d', 'H:i:s' and 'Y-m-d H:i:s'.
Custom fields
Custom fields are available in your resultset. Fields are prefixed with customfield_, and can be read and written to. For example: you've added a custom field to the Contacts section of Gripp, named Favorite color. This field will be named customfield_favoritecolor, as can be seen in the list showing all the custom fields (Instellingen > Vrije velden). This fields is now available for reading using get calls, for creating using create calls, and for updating using update calls.
Note: At the moment, it is not possible to use custom fields in filters.
Filters
A get-RPC call has two optional parameters. One of them is the filters parameter. It consists of an array of zero or more filter-objects, each consisting of 3 or 4 fields, depending on the operator.
field - the full fieldname, for example: invoice.number
operator - one of the following: in, notin, equals, notequals, between, greaterequals, greater, lessequals, less, like, isnull, isnotnull
value - the value to compare the field to
value2 - optional, needed for, for example, the 'between' operator.

Multiple filters can be added to the filter-parameter. Make sure it is an actual JSON-array, and not an object. See the examples.
Example filters:
<?php

// Filter example 1:
// Get all companies with a specific tag
$tag_ids = array(1, 2, 3);
$filters = array(
    array(
    	"field" => "company.tags",
    	"operator" => "in",
    	"value" => $tag_id
    )
);

// Filter example 2:
// Get all companies that are between 2 specified id's
$filters = array(
    array(
    	"field" => "company.id",
    	"operator" => "between",
    	"value" => 1,
    	"value2" => 5
    )
);

// Filter example 3:
// Get all the not null values (does not work on empty strings)
$filters = array(
    array(
    	"field" => "company.foundationdate",
    	"operator" => "isnotnull",    	
    	"value" => ""
    )
);

// Filter example 4:
// Get companies with a name that ends with 'B.V.' (More info: SQL LIKE OPERATOR)
$filters = array(
    array(
    	"field" => "company.companyname",
    	"operator" => "like",    	
    	"value" => "% B.V."
    )
);
Working with ID's
It's important to realize that some fieldvalues require the actual database ID's. For instance, when adding a contact to a company, the 'company' field requires the ID of the company. All companies have a unique 'customernumber', that can be used to request the company uniquely. In the result, the ID is available for further usage.

As another example, the creation of a company requires the field 'identity'. The value for the identity can be retreived from Gripp itself. Navigate to Settings > Identities & Templates. All the available identities are listed, including their number. This number equals the ID that can be used in API-calls, whenever the 'identity' field is required.
Options
The second parameter of the get-RPC call is the options-array. Currently, the Gripp API provides 2 options: paging and orderings.

Paging (required for get-calls)
The paging parameter can be used to get a subset of a resultset, much like the LIMIT function on an ordinary SQL-query. The paging parameter is an object consisting of the following keys:
firstresult - the offset of the resultset
maxresults - the maximum number of items in the resultset. The maximum is currently limited to 250.

Orderings
The second option is an array of ordering-objects. Each ordering-object consists of the following keys:
field - the full fieldname, for example: invoice.number
direction - 'asc' of 'desc'
Since the orderings options is an array, multiple ordering-objects can be added to provide ordering on multiple levels.
Rate limits
The number of API-requests is limited to 1000 requests per hour. This way, we provide our regular web users with the best service. When the limit is reached, your request will not be processed further. We provide two special headers in the response message, indicating the current limit, and the number of requests already made this hour.
X-RateLimit-Limit: the maximum number of requests per hour
X-RateLimit-Remaining: the number of remaining requests for this hour
In addition to the limit per hour, we also enforce a maximum number of request per second, using a Token Bucket algorithm. The default capacity is 20, and is filled with 4 request a second. These numbers can change in future updates.

When you exceed the limit you will receive a JSON-RPC error message.

You can increase the hourly limit by purchasing one or more API Request Packs. See https://www.gripp.com/support/api-request-packs.
Deep linking
You can use the following format to deeplink to a page within Gripp immediately.
https://yourdomain.gripp.com/d/{ENTITY}/{MODE}/{ID}

Example: https://yourdomain.gripp.com/d/offer/view/12345
{ENTITY}	Replace {ENTITY} with the name of the entity. The entities are listed on the lefthand side of this page. Note that not alle entities have their own page within Gripp.
{MODE}	Replace {MODE} with either 'add', 'edit' or 'view'.
{ID}	Replace {ID} with the ID of the entity you wish to link to. In case of the 'add' mode, the ID must be ommitted.
Extended Properties
This field is available in all entities, and can be used to store additional metadata specific to their use case. For example you can put in a JSON string with additional information you can use in your own software. Or een external ID to link in your own application
Webhooks
Gripp also has webhooks for users who want to make their own extensions to the system. This way you can perform your own custom actions based on events within the system. Look on our support page about how to set up webhooks and how to work with them.